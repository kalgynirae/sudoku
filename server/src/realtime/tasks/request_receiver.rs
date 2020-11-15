use futures::prelude::*;
use futures::stream::{SplitSink, SplitStream};
use log::{debug, error, warn};
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};

use crate::cursors::SessionCursorSender;
use crate::error::SudokuError;
use crate::realtime::protocol::{
    serialize_response, write_to_socket, RequestMessage, ResponseMessage,
};
use crate::realtime::tasks::error::ApiTaskError;
use crate::room::{ClientSyncId, RoomState, SessionId};

pub struct RequestReceiver {
    pub room_state: Arc<Mutex<RoomState>>,
    pub ws_tx: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    pub ws_rx: Arc<Mutex<SplitStream<WebSocket>>>,
    pub session_id: SessionId,
    pub last_received_sync_id: Arc<Mutex<Option<ClientSyncId>>>,
    pub cursor_tx: SessionCursorSender,
}

impl RequestReceiver {
    pub async fn run(self) -> Result<(), ApiTaskError> {
        while let Some(request) = self.ws_rx.lock().await.next().await {
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
            let response = self.handle_web_socket_message(&request).await;
            if let Some(response) = response {
                write_to_socket(&self.ws_tx, serialize_response(response)?).await?;
            }
        }
        Result::<(), ApiTaskError>::Ok(())
    }

    async fn handle_web_socket_message(&self, ws_message: &Message) -> Option<ResponseMessage> {
        if let Ok(body) = ws_message.to_str() {
            debug!("received text messsage from client: {}", body);
            match serde_json::from_str::<RequestMessage>(body) {
                Ok(req) => self.handle_request_message(req).await,
                Err(err) => Some(SudokuError::SerdeJson(err).into()),
            }
        } else if ws_message.is_binary() {
            debug!("received unsupported binary message from client");
            Some(SudokuError::ReceivedBinaryMessage.into())
        } else {
            None
        }
    }

    async fn handle_request_message(&self, req: RequestMessage) -> Option<ResponseMessage> {
        match req {
            RequestMessage::SetBoardState { board_state } => {
                self.room_state.lock().await.board = board_state.clone();
                None
            }
            RequestMessage::ApplyDiffs { sync_id, diffs } => {
                let mut rs = self.room_state.lock().await;
                let mut last_received_sync_id_guard = self.last_received_sync_id.lock().await;
                *last_received_sync_id_guard = Some(sync_id);
                if let Err(err) = rs.apply_diffs(self.session_id, sync_id, diffs) {
                    Some(ResponseMessage::Error { message: err })
                } else {
                    None
                }
            }
            RequestMessage::UpdateCursor { selection } => {
                if let Err(err) = self.cursor_tx.update(selection) {
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
}
