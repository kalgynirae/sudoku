mod board;
mod digit;
mod error;
mod room;

use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use crate::board::{BoardDiff, BoardDiffOperation, BoardState};
use crate::digit::Digit;
use crate::error::SudokuError;
use crate::room::{BoardDiffBroadcast, ClientSyncId, RoomId, RoomState, Session, SessionId};

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ResponseMessage {
    #[serde(rename_all = "camelCase")]
    Init {
        room_id: String,
        board_state: BoardState,
    },
    #[serde(rename_all = "camelCase")]
    PartialUpdate {
        sync_id: Option<ClientSyncId>,
        diffs: Vec<BoardDiff>,
    },
    /// Sent when the client falls too far behind (RecvError::Lagged)
    #[allow(dead_code)]
    #[serde(rename_all = "camelCase")]
    FullUpdate {
        sync_id: Option<ClientSyncId>,
        board_state: BoardState,
    },
    #[serde(rename_all = "camelCase")]
    Error { message: SudokuError },
}

impl From<SudokuError> for ResponseMessage {
    fn from(err: SudokuError) -> ResponseMessage {
        ResponseMessage::Error { message: err }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum RequestMessage {
    #[serde(rename_all = "camelCase")]
    SetBoardState { board_state: BoardState },
    #[serde(rename_all = "camelCase")]
    ApplyDiffs {
        sync_id: ClientSyncId,
        diffs: Vec<BoardDiff>,
    },
}

#[derive(Default)]
struct GlobalState {
    // TODO: rooms are never cleaned up. We need to GC them and maybe move them to a database
    rooms: HashMap<RoomId, Arc<Mutex<RoomState>>>,
    room_counter: RoomId,
}

async fn handle_request_message(
    room_state: Arc<Mutex<RoomState>>,
    session_id: SessionId,
    req: RequestMessage,
    last_received_sync_id: &Mutex<Option<ClientSyncId>>,
) -> Option<ResponseMessage> {
    match req {
        RequestMessage::SetBoardState { board_state } => {
            room_state.lock().await.board = board_state.clone();
            None
        }
        RequestMessage::ApplyDiffs { sync_id, diffs } => {
            let mut rs = room_state.lock().await;
            let mut last_received_sync_id_guard = last_received_sync_id.lock().await;
            *last_received_sync_id_guard = Some(sync_id);
            if let Err(err) = rs.apply_diffs(session_id, sync_id, diffs) {
                Some(ResponseMessage::Error { message: err })
            } else {
                None
            }
        }
    }
}

async fn handle_web_socket_message(
    room_state: Arc<Mutex<RoomState>>,
    session_id: SessionId,
    ws_message: &Message,
    last_received_sync_id: &Mutex<Option<ClientSyncId>>,
) -> Option<ResponseMessage> {
    if let Ok(body) = ws_message.to_str() {
        debug!("received text messsage from client: {}", body);
        match serde_json::from_str::<RequestMessage>(body) {
            Ok(req) => {
                handle_request_message(room_state, session_id, req, last_received_sync_id).await
            }
            Err(err) => Some(SudokuError::SerdeJson(err).into()),
        }
    } else if ws_message.is_binary() {
        debug!("received unsupported binary message from client");
        Some(SudokuError::ReceivedBinaryMessage.into())
    } else {
        None
    }
}

async fn handle_diff_broadcast(
    room_state: &Mutex<RoomState>,
    broadcast: Result<Arc<BoardDiffBroadcast>, broadcast::RecvError>,
    broadcast_rx: &mut broadcast::Receiver<Arc<BoardDiffBroadcast>>,
    session_id: SessionId,
    last_received_sync_id: &Mutex<Option<ClientSyncId>>,
    last_sent_sync_id: &Mutex<Option<ClientSyncId>>,
) -> ResponseMessage {
    match broadcast {
        Ok(bc) => {
            let mut sync_id_guard = last_sent_sync_id.lock().await;
            if bc.sender_id == session_id {
                *sync_id_guard = Some(bc.sync_id);
            }
            ResponseMessage::PartialUpdate {
                sync_id: *sync_id_guard,
                diffs: bc.board_diffs.clone(),
            }
        }
        Err(broadcast::RecvError::Lagged(_)) => {
            let (mut last_sent_sync_id_guard, last_received_sync_id_guard, room_state_guard) = tokio::join!(
                last_sent_sync_id.lock(),
                last_received_sync_id.lock(),
                room_state.lock()
            );
            *last_sent_sync_id_guard = *last_received_sync_id_guard;
            *broadcast_rx = room_state_guard.new_sessionless_receiver();
            ResponseMessage::FullUpdate {
                sync_id: *last_received_sync_id_guard,
                board_state: room_state_guard.board.clone(),
            }
        }
        Err(broadcast::RecvError::Closed) => {
            error!("broadcast channel is closed; this shouldn't happen");
            SudokuError::Internal(broadcast::RecvError::Closed.into()).into()
        }
    }
}

async fn handle_realtime_api(ws: WebSocket, room_state: Arc<Mutex<RoomState>>) {
    let (ws_tx, ws_rx) = ws.split();
    let ws_tx = Arc::new(Mutex::new(ws_tx));
    let ws_rx = Arc::new(Mutex::new(ws_rx));

    // create a new session and prepare it to be shared across multiple tasks
    let Session {
        session_id,
        mut diff_rx,
    } = match room_state.lock().await.new_session() {
        Ok(session) => session,
        Err(err) => {
            let _possible_error =
                write_response_to_socket(&ws_tx, ResponseMessage::from(err)).await;
            close_websocket(ws_tx, ws_rx).await;
            return;
        }
    };
    let last_received_sync_id: Arc<Mutex<Option<ClientSyncId>>> = Arc::new(Mutex::new(None));
    let last_sent_sync_id: Arc<Mutex<Option<ClientSyncId>>> = Arc::new(Mutex::new(None));

    debug!("sending init message to client");
    let init_msg = {
        // release the lock as soon as the message is constructed, before we send it
        let rs = room_state.lock().await;
        ResponseMessage::Init {
            room_id: rs.room_id.to_string(),
            // It's expensive, but clone this so we don't have to keep holding onto the lock.
            // Maybe this could be an Arc<Cow<>>.
            board_state: rs.board.clone(),
        }
    };
    let write_result = write_response_to_socket(&ws_tx, init_msg).await;

    if write_result.is_err() {
        debug!("failed to send init message, so closing socket instead");
        close_websocket(ws_tx, ws_rx).await;
        return;
    }

    let request_receiver = {
        let ws_tx = ws_tx.clone();
        let ws_rx = ws_rx.clone();
        let last_received_sync_id = last_received_sync_id.clone();
        let room_state = room_state.clone();
        async move {
            while let Some(request) = ws_rx.lock().await.next().await {
                let request = match request {
                    Ok(val) => val,
                    Err(err) => {
                        warn!("error reading from socket: {}", err);
                        break;
                    }
                };
                if request.is_close() {
                    return;
                }
                let response = handle_web_socket_message(
                    room_state.clone(),
                    session_id,
                    &request,
                    &last_received_sync_id,
                )
                .await;
                if write_response_to_socket(&ws_tx, response).await.is_err() {
                    break;
                }
            }
        }
    };

    let broadcast_receiver = {
        let ws_tx = ws_tx.clone();
        let last_received_sync_id = last_received_sync_id.clone();
        let last_sent_sync_id = last_sent_sync_id.clone();
        let room_state = room_state.clone();
        async move {
            loop {
                let diff_broadcast = diff_rx.recv().await;
                if let Err(broadcast::RecvError::Closed) = diff_broadcast {
                    return;
                }
                let response = handle_diff_broadcast(
                    &room_state,
                    diff_broadcast,
                    &mut diff_rx,
                    session_id,
                    &last_received_sync_id,
                    &last_sent_sync_id,
                )
                .await;
                if write_response_to_socket(&ws_tx, response).await.is_err() {
                    break;
                }
            }
        }
    };

    tokio::select! {
        () = request_receiver => {},
        () = broadcast_receiver => {},
    };

    close_websocket(ws_tx, ws_rx).await;
}

async fn write_response_to_socket<R: Into<Option<ResponseMessage>>>(
    ws_tx: &Mutex<SplitSink<WebSocket, Message>>,
    msg: R,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    if let Some(msg) = msg.into() {
        let response_str = serde_json::to_string(&msg).map_err(|err| {
            error!("failed to serialize response: {}", err);
            err
        })?;
        debug!("sending response to client: {}", response_str);
        ws_tx
            .lock()
            .await
            .send(Message::text(response_str))
            .await
            .map_err(|err| {
                warn!("got an error upon writing to socket: {}", err);
                err
            })?;
    }
    Ok(())
}

/// Helper for closing the websocket by unwrapping arcs and reuniting the sink and stream halves of
/// the stream.
///
/// This shouldn't panic under normal operation, but it will panic if misused:
///
/// - If other tasks still have references to the `ws_tx` or `ws_rx`
/// - If `ws_tx` and `ws_rx` are from a different socket.
async fn close_websocket(
    ws_tx: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    ws_rx: Arc<Mutex<SplitStream<WebSocket>>>,
) {
    debug!("gracefully closing websocket");
    let ws_tx = Arc::try_unwrap(ws_tx)
        .expect("there should be one ref to ws_tx once our tasks are finished")
        .into_inner();
    let ws_rx = Arc::try_unwrap(ws_rx)
        .expect("there should be one ref to ws_rx once our tasks are finished")
        .into_inner();
    if let Err(err) = ws_tx
        .reunite(ws_rx)
        .expect("ws_tx and ws_rx are always from the same stream")
        .close()
        .await
    {
        debug!("failed to close websocket: {}", err);
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    info!("starting server");

    let global_state: Arc<Mutex<GlobalState>> = Arc::new(Mutex::new(Default::default()));
    let global_state = warp::any().map(move || global_state.clone());

    let realtime_api = warp::path!("api" / "v1" / "realtime" / ..)
        .and(
            // TODO: room ids should be unguessable keys
            warp::path::param::<RoomId>()
                .map(Some)
                .or(warp::any().map(|| None))
                .unify(),
        )
        .and(global_state)
        .and_then(
            |room_id, global_state: Arc<Mutex<GlobalState>>| async move {
                Result::<Arc<Mutex<RoomState>>, warp::reject::Rejection>::Ok(match room_id {
                    Some(room_id) => {
                        let global_state = &mut *global_state.lock().await;
                        global_state
                            .rooms
                            .get(&room_id)
                            .ok_or(warp::reject::not_found())?
                            .clone()
                    }
                    None => {
                        let global_state = &mut *global_state.lock().await;
                        let room_id = global_state.room_counter;
                        global_state.room_counter += 1;
                        let room_state = Arc::new(Mutex::new(RoomState::new(room_id)));
                        global_state.rooms.insert(room_id, room_state.clone());
                        room_state
                    }
                })
            },
        )
        .and(warp::path::end())
        .and(warp::ws())
        .map(|room_state: Arc<Mutex<RoomState>>, ws: warp::ws::Ws| {
            // board states aren't very big and we already have our own board diff queue, so keep
            // these queue sizes small
            ws.max_send_queue(1 * 1024 * 1024)
                .max_message_size(512 * 1024)
                .max_frame_size(512 * 1024)
                .on_upgrade(move |web_socket| handle_realtime_api(web_socket, room_state))
        });

    // TODO: Delete: Testing serialization
    debug!(
        "{}",
        serde_json::to_string(&RequestMessage::ApplyDiffs {
            sync_id: 20,
            diffs: vec![BoardDiff {
                squares: vec![1, 2],
                operation: BoardDiffOperation::SetNumber {
                    digit: Some(Digit::D5),
                },
            }],
        })
        .unwrap()
    );

    warp::serve(realtime_api)
        .run("127.0.0.1:9091".parse::<SocketAddr>().unwrap())
        .await;
}
