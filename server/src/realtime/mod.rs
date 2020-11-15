pub mod protocol;
pub mod tasks;

use futures::prelude::*;
use futures::stream::{SplitSink, SplitStream};
use log::{debug, error, warn};
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::filters::BoxedFilter;
use warp::ws::{Message, WebSocket};
use warp::{Filter, Reply};

use crate::cursors::SessionCursor;
use crate::global_state::GlobalState;
use crate::realtime::protocol::{
    serialize_response, write_to_socket, ResponseMessage, SocketWriteError,
};
use crate::realtime::tasks::error::ApiTaskError;
use crate::realtime::tasks::{CursorNotifyReceiver, DiffBroadcastReceiver, RequestReceiver};
use crate::room::{ClientSyncId, RoomId, RoomState, Session};

pub fn get_filter(global_state: Arc<Mutex<GlobalState>>) -> BoxedFilter<(impl Reply,)> {
    warp::path!("api" / "v1" / "realtime" / ..)
        .and(
            // TODO: room ids should be unguessable keys
            warp::path::param::<RoomId>()
                .map(Some)
                .or(warp::any().map(|| None))
                .unify(),
        )
        .and(warp::any().map(move || global_state.clone()))
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
        })
        .boxed()
}

async fn handle_realtime_api(ws: WebSocket, room_state: Arc<Mutex<RoomState>>) {
    let (ws_tx, ws_rx) = ws.split();
    let ws_tx = Arc::new(Mutex::new(ws_tx));
    let ws_rx = Arc::new(Mutex::new(ws_rx));

    // create a new session and prepare it to be shared across multiple tasks
    let Session {
        session_id,
        diff_rx,
        cursor: SessionCursor {
            tx: cursor_tx,
            rx: cursor_rx,
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

    let request_receiver = RequestReceiver {
        room_state: room_state.clone(),
        ws_tx: ws_tx.clone(),
        ws_rx: ws_rx.clone(),
        session_id,
        last_received_sync_id: last_received_sync_id.clone(),
        cursor_tx,
    }
    .run();

    let diff_broadcast_receiver = DiffBroadcastReceiver {
        room_state: room_state.clone(),
        ws_tx: ws_tx.clone(),
        diff_rx,
        session_id,
        last_received_sync_id: last_received_sync_id.clone(),
        last_sent_sync_id: last_sent_sync_id.clone(),
    }
    .run();

    let cursor_notify_receiver = CursorNotifyReceiver {
        ws_tx: ws_tx.clone(),
        cursor_rx,
    }
    .run();

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
