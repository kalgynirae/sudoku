mod board;
mod digit;
mod room;

use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use crate::board::{BoardDiff, BoardDiffOperation, BoardState};
use crate::digit::Digit;
use crate::room::{ClientSyncId, RoomId, RoomState, Session, SessionId};

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
    Error {
        sync_id: Option<ClientSyncId>,
        message: &'static str,
    },
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
) -> Option<ResponseMessage> {
    match req {
        RequestMessage::SetBoardState { board_state } => {
            // TODO: store sync_id
            room_state.lock().await.board = board_state.clone();
            None
        }
        RequestMessage::ApplyDiffs { sync_id, diffs } => {
            let mut rs = room_state.lock().await;
            if let Err(err) = rs.apply_diffs(session_id, sync_id, diffs) {
                Some(ResponseMessage::Error {
                    sync_id: Some(sync_id),
                    message: err,
                })
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
) -> Result<Option<ResponseMessage>, &'static str> {
    Ok(if ws_message.is_text() {
        let body = ws_message.to_str().or(Err("internal error"))?;
        debug!("received text messsage from client: {}", body);
        handle_request_message(
            room_state,
            session_id,
            serde_json::from_str::<RequestMessage>(body).or(Err("bad request"))?,
        )
        .await
    } else if ws_message.is_binary() {
        debug!("received unsupported binary message from client");
        Err("messages must be JSON-encoded text, not binary blobs")?
    } else {
        None
    })
}

/*async fn handle_diff_broadcast(
    last_read_sync_id: &Mutex<ClientSyncId>,
    last_sent_sync_id: &Mutex<ClientSyncId>,
) -> Result<ResponseMessage, &'static str> {
}*/

async fn handle_realtime_api(ws: WebSocket, room_state: Arc<Mutex<RoomState>>) {
    let (ws_tx, ws_rx) = ws.split();
    let ws_tx = Arc::new(Mutex::new(ws_tx));
    let ws_rx = Arc::new(Mutex::new(ws_rx));

    // create a new session and prepare it to be shared across multiple tasks
    let Session {
        session_id,
        sync_id,
        mut diff_rx,
    } = match room_state.lock().await.new_session() {
        Ok(session) => session,
        Err(err) => {
            let _possible_error = write_response_to_socket(
                &ws_tx,
                &ResponseMessage::Error {
                    sync_id: None,
                    message: err,
                },
            )
            .await;
            close_websocket(ws_tx, ws_rx).await;
            return;
        }
    };
    let sync_id = Arc::new(Mutex::new(sync_id));

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
    let write_result = write_response_to_socket(&ws_tx, &init_msg).await;

    if write_result.is_err() {
        debug!("failed to send init message, so closing socket instead");
        close_websocket(ws_tx, ws_rx).await;
        return;
    }

    let request_receiver = {
        let ws_tx = ws_tx.clone();
        let ws_rx = ws_rx.clone();
        let sync_id = sync_id.clone();
        async move {
            while let Some(msg) = ws_rx.lock().await.next().await {
                let msg = match msg {
                    Ok(val) => val,
                    Err(err) => {
                        warn!("error reading from socket: {}", err);
                        break;
                    }
                };
                if msg.is_close() {
                    return;
                }

                let response =
                    match handle_web_socket_message(room_state.clone(), session_id, &msg).await {
                        Ok(r) => r,
                        Err(err) => Some(ResponseMessage::Error {
                            sync_id: *sync_id.lock().await,
                            message: &err,
                        }),
                    };
                match response {
                    Some(msg) => {
                        if let Err(_) = write_response_to_socket(&ws_tx, &msg).await {
                            break;
                        }
                    }
                    None => {}
                };
            }
        }
    };

    let broadcast_receiver = {
        let ws_tx = ws_tx.clone();
        let sync_id = sync_id.clone();
        async move {
            while let Ok(diff_broadcast) = diff_rx.recv().await {
                let current_sync_id = {
                    let mut sync_id_guard = sync_id.lock().await;
                    if diff_broadcast.sender_id == session_id {
                        *sync_id_guard = Some(diff_broadcast.sync_id);
                    }
                    *sync_id_guard
                };
                let msg = ResponseMessage::PartialUpdate {
                    sync_id: current_sync_id,
                    diffs: diff_broadcast.board_diffs.clone(),
                };
                if let Err(_) = write_response_to_socket(&ws_tx, &msg).await {
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

async fn write_response_to_socket(
    ws_tx: &Mutex<SplitSink<WebSocket, Message>>,
    msg: &ResponseMessage,
) -> Result<(), Box<dyn Error + Sync + Send>> {
    let response_str = serde_json::to_string(msg)?;
    debug!("sending response to client: {}", response_str);
    let write_result = ws_tx.lock().await.send(Message::text(response_str)).await;
    if let Err(err) = write_result {
        warn!("got an error upon writing to socket: {}", err);
        Err(err)?;
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
