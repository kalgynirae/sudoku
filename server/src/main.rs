mod board;
mod cursors;
mod digit;
mod error;
mod room;

use futures::prelude::*;
use futures::stream::{SplitSink, SplitStream};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::fmt;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use crate::board::{BoardDiff, BoardDiffOperation, BoardState};
use crate::cursors::{
    CursorReceiveError, CursorSelection, CursorsMapView, SessionCursor, SessionCursorSender,
};
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
    #[serde(rename_all = "camelCase")]
    FullUpdate {
        sync_id: Option<ClientSyncId>,
        board_state: BoardState,
    },
    #[serde(rename_all = "camelCase")]
    UpdateCursor { map: CursorsMapView },
    #[serde(rename_all = "camelCase")]
    Error { message: SudokuError },
}

impl From<SudokuError> for ResponseMessage {
    fn from(err: SudokuError) -> Self {
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
    #[serde(rename_all = "camelCase")]
    UpdateCursor { selection: CursorSelection },
}

#[derive(Default)]
struct GlobalState {
    // TODO: rooms are never cleaned up. We need to GC them and maybe move them to a database
    rooms: HashMap<RoomId, Arc<Mutex<RoomState>>>,
}

async fn handle_request_message(
    room_state: Arc<Mutex<RoomState>>,
    session_id: SessionId,
    req: RequestMessage,
    last_received_sync_id: &Mutex<Option<ClientSyncId>>,
    cursor_tx: &SessionCursorSender,
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
        RequestMessage::UpdateCursor { selection } => {
            if let Err(err) = cursor_tx.update(selection) {
                // this should never happen
                error!("{}", err);
                Some(ResponseMessage::Error {
                    message: SudokuError::Internal(Box::new(err)),
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
    last_received_sync_id: &Mutex<Option<ClientSyncId>>,
    cursor_tx: &SessionCursorSender,
) -> Option<ResponseMessage> {
    if let Ok(body) = ws_message.to_str() {
        debug!("received text messsage from client: {}", body);
        match serde_json::from_str::<RequestMessage>(body) {
            Ok(req) => {
                handle_request_message(
                    room_state,
                    session_id,
                    req,
                    last_received_sync_id,
                    cursor_tx,
                )
                .await
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
        cursor: SessionCursor {
            tx: cursor_tx,
            rx: mut cursor_rx,
        },
    } = match room_state.lock().await.new_session() {
        Ok(session) => session,
        Err(err) => {
            let response_result = serialize_response(ResponseMessage::from(err));
            if let Ok(response) = response_result {
                let _possible_error = write_to_socket(&ws_tx, response).await;
            }
            close_websocket(ws_tx, ws_rx).await;
            return;
        }
    };
    let last_received_sync_id: Arc<Mutex<Option<ClientSyncId>>> = Arc::new(Mutex::new(None));
    let last_sent_sync_id: Arc<Mutex<Option<ClientSyncId>>> = Arc::new(Mutex::new(None));

    debug!("sending init message to client");
    let write_result = async {
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
        write_to_socket(&ws_tx, serialize_response(init_msg)?).await
    }
    .await;

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
                    return Ok(());
                }
                let response = handle_web_socket_message(
                    room_state.clone(),
                    session_id,
                    &request,
                    &last_received_sync_id,
                    &cursor_tx,
                )
                .await;
                if let Some(response) = response {
                    write_to_socket(&ws_tx, serialize_response(response)?).await?;
                }
            }
            Result::<(), ApiTaskError>::Ok(())
        }
    };

    let diff_broadcast_receiver = {
        let ws_tx = ws_tx.clone();
        let last_received_sync_id = last_received_sync_id.clone();
        let last_sent_sync_id = last_sent_sync_id.clone();
        let room_state = room_state.clone();
        async move {
            loop {
                let diff_broadcast = diff_rx.recv().await;
                if let Err(broadcast::RecvError::Closed) = diff_broadcast {
                    return Result::<(), ApiTaskError>::Ok(());
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
                write_to_socket(&ws_tx, serialize_response(response)?).await?;
            }
        }
    };

    let cursor_notify_receiver = {
        let ws_tx = ws_tx.clone();
        async move {
            loop {
                let cursor_map_view = cursor_rx.recv().await?;
                let response = ResponseMessage::UpdateCursor {
                    map: cursor_map_view,
                };
                write_to_socket(&ws_tx, serialize_response(response)?).await?;
            }
        }
    };

    let result = tokio::select! {
        r = request_receiver => r,
        r = diff_broadcast_receiver => r,
        r = cursor_notify_receiver => r,
    };

    match result {
        Err(err) => match err {
            // use a nested match because Result doesn't implement Display
            ApiTaskError::CursorReceive(_) => {
                error!("{}", err);
            }
            ApiTaskError::SocketWrite(SocketWriteError::Serialization(_)) => {
                error!("{}", err);
            }
            ApiTaskError::SocketWrite(SocketWriteError::Warp(_)) => {
                // this is probably just a network issue, so use a lower severity
                warn!("{}", err);
            }
        },
        Ok(_) => {}
    }

    close_websocket(ws_tx, ws_rx).await;
}

#[derive(Debug)]
enum ApiTaskError {
    CursorReceive(CursorReceiveError),
    SocketWrite(SocketWriteError),
}

impl fmt::Display for ApiTaskError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CursorReceive(err) => write!(f, "{}", err),
            Self::SocketWrite(err) => write!(f, "{}", err),
        }
    }
}

impl Error for ApiTaskError {}

impl From<CursorReceiveError> for ApiTaskError {
    fn from(err: CursorReceiveError) -> Self {
        Self::CursorReceive(err)
    }
}

impl From<SocketWriteError> for ApiTaskError {
    fn from(err: SocketWriteError) -> Self {
        Self::SocketWrite(err)
    }
}

#[derive(Debug)]
enum SocketWriteError {
    Serialization(serde_json::Error),
    Warp(warp::Error),
}

impl fmt::Display for SocketWriteError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let err: Box<&dyn Error> = match self {
            Self::Serialization(err) => Box::new(err),
            Self::Warp(err) => Box::new(err),
        };
        write!(
            f,
            "Error occured while attempting to write to socket: {}",
            err
        )
    }
}

impl Error for SocketWriteError {}

impl From<serde_json::Error> for SocketWriteError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err)
    }
}

impl From<warp::Error> for SocketWriteError {
    fn from(err: warp::Error) -> Self {
        Self::Warp(err)
    }
}

fn serialize_response(msg: ResponseMessage) -> Result<Message, SocketWriteError> {
    let text = serde_json::to_string(&msg)?;
    Ok(Message::text(text))
}

// You must serialize the response before passing it into this function because ResponseMessage is
// not Send.
async fn write_to_socket(
    ws_tx: &Mutex<SplitSink<WebSocket, Message>>,
    msg: Message,
) -> Result<(), SocketWriteError> {
    if let Some(msg) = msg.into() {
        if let Ok(msg_text) = msg.to_str() {
            debug!("sending response to client: {}", msg_text);
        }
        ws_tx.lock().await.send(msg).await?;
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
                        let room_id = RoomId::random();
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
