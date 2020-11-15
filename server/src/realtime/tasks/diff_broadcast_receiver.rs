use futures::stream::SplitSink;
use log::error;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use warp::ws::{Message, WebSocket};

use crate::error::SudokuError;
use crate::realtime::protocol::{serialize_response, write_to_socket, ResponseMessage};
use crate::realtime::tasks::error::ApiTaskError;
use crate::room::{BoardDiffBroadcast, ClientSyncId, RoomState, SessionId};

pub struct DiffBroadcastReceiver {
    pub room_state: Arc<Mutex<RoomState>>,
    pub ws_tx: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    pub diff_rx: broadcast::Receiver<Arc<BoardDiffBroadcast>>,
    pub session_id: SessionId,
    pub last_received_sync_id: Arc<Mutex<Option<ClientSyncId>>>,
    pub last_sent_sync_id: Arc<Mutex<Option<ClientSyncId>>>,
}

impl DiffBroadcastReceiver {
    pub async fn run(mut self) -> Result<(), ApiTaskError> {
        loop {
            let diff_broadcast = self.diff_rx.recv().await;
            if let Err(broadcast::RecvError::Closed) = diff_broadcast {
                return Result::<(), ApiTaskError>::Ok(());
            }
            let response = self.handle_diff_broadcast(diff_broadcast).await;
            write_to_socket(&self.ws_tx, serialize_response(response)?).await?;
        }
    }

    async fn handle_diff_broadcast(
        &mut self,
        broadcast: Result<Arc<BoardDiffBroadcast>, broadcast::RecvError>,
    ) -> ResponseMessage {
        match broadcast {
            Ok(bc) => {
                let mut sync_id_guard = self.last_sent_sync_id.lock().await;
                if bc.sender_id == self.session_id {
                    *sync_id_guard = Some(bc.sync_id);
                }
                ResponseMessage::PartialUpdate {
                    sync_id: *sync_id_guard,
                    diffs: bc.board_diffs.clone(),
                }
            }
            Err(broadcast::RecvError::Lagged(_)) => {
                let (mut last_sent_sync_id_guard, last_received_sync_id_guard, room_state_guard) = tokio::join!(
                    self.last_sent_sync_id.lock(),
                    self.last_received_sync_id.lock(),
                    self.room_state.lock()
                );
                *last_sent_sync_id_guard = *last_received_sync_id_guard;
                self.diff_rx = room_state_guard.new_sessionless_receiver();
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
}
