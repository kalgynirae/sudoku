use std::error::Error;
use std::fmt;
use tokio::sync::watch;

use crate::cursors::map::CursorsMap;
use crate::cursors::map::CursorsMapIndex;

/// This is an ugly wrapper around `watch::error::SendError<CursorsMap>` to avoid leaking CursorMap
/// as a public type since enum fields are always public.
#[derive(Debug)]
pub struct WatchSendErrorWrapper(pub(super) watch::error::SendError<CursorsMap>);

#[derive(Debug)]
#[non_exhaustive]
pub enum CursorUpdateError {
    Full,
    // This shouldn't be possible since Arc<CursorsInner> holds onto tx and rx, so the
    // channel can't close until CursorInner is dropped.
    Notify(WatchSendErrorWrapper),
    // LockError is caused by a PoisonError, but retaining the PoisonError is too tricky because it
    // holds the lock's guard (and it's associated lifetime).
    Lock,
    // The CursorsMapIndex used on this map is bad. Either it's stale or an index for another map.
    InvalidIndex(CursorsMapIndex),
}

impl fmt::Display for CursorUpdateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Full => write!(f, "Attempted to insert into a full cursor map"),
            Self::Notify(WatchSendErrorWrapper(err)) => {
                write!(f, "Failed to notify cursor receivers: {}", err)
            }
            Self::Lock => write!(f, "Failed to acquire a cursor write lock."),
            Self::InvalidIndex(idx) => write!(f, "Cursor index {:?} is invalid for the map.", idx),
        }
    }
}

impl Error for CursorUpdateError {}

#[derive(Debug)]
#[non_exhaustive]
pub enum CursorReceiveError {
    // This shouldn't be possible since Arc<CursorsInner> holds onto tx and rx.
    Notify,
    // LockError is caused by a PoisonError.
    Lock,
}

impl fmt::Display for CursorReceiveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Notify => write!(f, "Tried to recv, but the watch channel was closed."),
            Self::Lock => write!(f, "Failed to acquire a cursor read lock."),
        }
    }
}

impl Error for CursorReceiveError {}
