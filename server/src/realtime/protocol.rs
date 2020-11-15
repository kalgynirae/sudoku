use futures::prelude::*;
use futures::stream::SplitSink;
use log::debug;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};

use crate::board::{BoardDiff, BoardState};
use crate::cursors::{CursorSelection, CursorsMapView};
use crate::error::SudokuError;
use crate::room::ClientSyncId;

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ResponseMessage {
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

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RequestMessage {
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

#[derive(Debug)]
pub enum SocketWriteError {
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

pub fn serialize_response(msg: ResponseMessage) -> Result<Message, SocketWriteError> {
    let text = serde_json::to_string(&msg)?;
    Ok(Message::text(text))
}

pub async fn write_to_socket(
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
