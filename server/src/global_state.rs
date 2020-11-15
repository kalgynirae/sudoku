use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::room::{RoomId, RoomState};

#[derive(Default)]
pub struct GlobalState {
    // TODO: rooms are never cleaned up. We need to GC them and maybe move them to a database
    pub rooms: HashMap<RoomId, Arc<Mutex<RoomState>>>,
}
