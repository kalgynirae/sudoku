use futures::stream::SplitSink;
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};

use crate::cursors::SessionCursorReceiver;
use crate::realtime::protocol::{serialize_response, write_to_socket, ResponseMessage};
use crate::realtime::tasks::error::ApiTaskError;

pub struct CursorNotifyReceiver {
    pub ws_tx: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    pub cursor_rx: SessionCursorReceiver,
}

impl CursorNotifyReceiver {
    pub async fn run(mut self) -> Result<(), ApiTaskError> {
        loop {
            let cursor_map_view = self.cursor_rx.recv().await?;
            let response = ResponseMessage::UpdateCursor {
                map: cursor_map_view,
            };
            write_to_socket(&self.ws_tx, serialize_response(response)?).await?;
        }
    }
}
