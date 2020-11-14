mod id;

use log::error;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::board::{BoardDiff, BoardState};
use crate::cursors::{Cursors, SessionCursor};
use crate::error::SudokuError;
pub use crate::room::id::RoomId;

// Limit the number of sessions per room because:
// - We have to send O(n^2) messages per n clients
// - We need to assign a unique color to each cursor, and there's only so many unique-looking
//   colors.
pub const MAX_SESSIONS_PER_ROOM: usize = 8;
// If we exhaust this queue size and the websocket buffer, the client has lagged, and we should
// send them a FullUpdate next time.
const MAX_BOARD_DIFF_GROUP_QUEUE: usize = 32;
// The client's high-level operations can be applied as a group of diffs. This needs to be larger
// than the largest possible set of diffs that can be generated when handling a high-level
// operation.
const MAX_BOARD_DIFF_GROUP_SIZE: usize = 8;

pub type BoardId = u64;
pub type SessionId = u64;

// The client should send an increasing value with each diff. When we send a message to the client,
// we share the last value we saw. The client can then use this information to figure out which
// of it's diffs haven't been applied yet.
//
// A sync ID can be None if we haven't received a sync id from the client yet.
pub type ClientSyncId = u64;

pub struct Session {
    pub session_id: SessionId,
    pub diff_rx: broadcast::Receiver<Arc<BoardDiffBroadcast>>,
    pub cursor: SessionCursor,
}

pub struct BoardDiffBroadcast {
    pub board_diffs: Vec<BoardDiff>,
    // these allow the sender to identify it's own messages and use that to update the current
    // sync_id.
    pub sender_id: SessionId,
    pub sync_id: ClientSyncId,
}

pub struct RoomState {
    pub room_id: RoomId,
    #[allow(dead_code)]
    pub board_id: BoardId,
    pub board: BoardState,
    // DO NOT send to this without grabbing the mutex first, otherwise the board state could fall
    // behind. This is a private member and only used via RoomState::apply.
    diff_tx: broadcast::Sender<Arc<BoardDiffBroadcast>>,
    /// Used to create unique session_ids for each Session
    session_counter: SessionId,
    cursors: Cursors,
}

impl RoomState {
    pub fn new(room_id: RoomId) -> RoomState {
        let (diff_tx, _diff_rx) = broadcast::channel(MAX_BOARD_DIFF_GROUP_QUEUE);
        RoomState {
            room_id,
            board_id: 0,
            board: Default::default(),
            diff_tx,
            session_counter: 0,
            cursors: Cursors::new(),
        }
    }

    pub fn new_session(&mut self) -> Result<Session, SudokuError> {
        self.session_counter += 1;
        Ok(Session {
            session_id: self.session_counter,
            diff_rx: self.diff_tx.subscribe(),
            cursor: self
                .cursors
                .new_session(self.session_counter)
                .or(Err(SudokuError::RoomFull(MAX_SESSIONS_PER_ROOM)))?,
        })
    }

    // creates a broadcast::Receiver without creating a new session. Useful for resetting the
    // receiver in an already-existing session.
    pub fn new_sessionless_receiver(&self) -> broadcast::Receiver<Arc<BoardDiffBroadcast>> {
        self.diff_tx.subscribe()
    }

    pub fn apply_diffs(
        &mut self,
        session_id: SessionId,
        sync_id: ClientSyncId,
        board_diffs: Vec<BoardDiff>,
    ) -> Result<(), SudokuError> {
        if board_diffs.len() > MAX_BOARD_DIFF_GROUP_SIZE {
            return Err(SudokuError::TooManyBoardDiffs(
                board_diffs.len(),
                MAX_BOARD_DIFF_GROUP_SIZE,
            ));
        }
        for bd in board_diffs.iter() {
            self.board.apply(bd)?;
        }
        let broadcast = BoardDiffBroadcast {
            board_diffs,
            sender_id: session_id,
            sync_id,
        };
        if let Err(_) = self.diff_tx.send(Arc::new(broadcast)) {
            // we shouldn't be sending if there's no receivers, because the session doing the
            // sending should also be receiving.
            error!("tried to send message to broadcast with no receivers")
        }
        Ok(())
    }
}
