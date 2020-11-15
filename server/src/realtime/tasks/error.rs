use std::error::Error;
use std::fmt;

use crate::cursors::CursorReceiveError;
use crate::realtime::protocol::SocketWriteError;

#[derive(Debug)]
pub enum ApiTaskError {
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
