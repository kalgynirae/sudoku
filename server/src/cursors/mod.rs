//! Exposes an API that wraps over [tokio::sync::watch] to share a map of cursor selections for
//! every client in the room.
//!
//! The underlying map is stored compactly on the stack using bitmasks, so cloning the resulting
//! value around is cheap-ish.

mod error;
mod map;
mod selection;

use log::error;
use std::sync::{Arc, Mutex};
use tokio::sync::watch;

use crate::cursors::error::WatchSendErrorWrapper;
pub use crate::cursors::error::{CursorReceiveError, CursorUpdateError};
pub use crate::cursors::map::CursorsMapView;
use crate::cursors::map::{CursorsMap, CursorsMapIndex};
pub use crate::cursors::selection::CursorSelection;

type SessionId = u64;

pub struct Cursors {
    inner: Arc<CursorsInner>,
}

impl Cursors {
    pub fn new() -> Self {
        let (tx, rx) = watch::channel(CursorsMap::new());
        Cursors {
            inner: Arc::new(CursorsInner {
                tx: Mutex::new(tx),
                rx,
            }),
        }
    }

    pub fn new_session(&self, session_id: SessionId) -> Result<SessionCursor, CursorUpdateError> {
        let map_idx = self.inner.apply(|map| map.new_session(session_id))?;
        Ok(SessionCursor {
            tx: SessionCursorSender {
                cursors_inner: self.inner.clone(),
                map_idx,
            },
            rx: SessionCursorReceiver {
                map_idx,
                rx: self.inner.rx.clone(),
            },
        })
    }
}

struct CursorsInner {
    tx: Mutex<watch::Sender<CursorsMap>>,
    rx: watch::Receiver<CursorsMap>,
}

impl CursorsInner {
    fn apply<F, R>(&self, operation: F) -> Result<R, CursorUpdateError>
    where
        F: Fn(&mut CursorsMap) -> Result<R, CursorUpdateError>,
    {
        let mut map = self.rx.borrow().clone();
        let ret = operation(&mut map)?;
        self.tx
            .lock()
            .or(Err(CursorUpdateError::Lock))?
            .broadcast(map)
            .map_err(|send_err| CursorUpdateError::Notify(WatchSendErrorWrapper(send_err)))?;
        Ok(ret)
    }
}

pub struct SessionCursor {
    pub tx: SessionCursorSender,
    pub rx: SessionCursorReceiver,
}

pub struct SessionCursorSender {
    cursors_inner: Arc<CursorsInner>,
    map_idx: CursorsMapIndex,
}

pub struct SessionCursorReceiver {
    map_idx: CursorsMapIndex,
    rx: watch::Receiver<CursorsMap>,
}

impl SessionCursorSender {
    pub fn update(&self, selection: CursorSelection) -> Result<(), CursorUpdateError> {
        self.cursors_inner
            .apply(|map| map.update(self.map_idx, selection))
    }
}

impl SessionCursorReceiver {
    /// Waits until somebody calls `update`, then clones the map and returns a CursorsMapView.
    ///
    /// The first time this is called, it returns immediately with the current value.
    pub async fn recv(&mut self) -> Result<CursorsMapView, CursorReceiveError> {
        let map = self.rx.recv().await.ok_or(CursorReceiveError::Notify)?;
        Ok(map.into_view(self.map_idx))
    }
}

impl Drop for SessionCursorSender {
    fn drop(&mut self) {
        if let Err(err) = self.cursors_inner.apply(|map| map.remove(self.map_idx)) {
            error!(
                "Got an non-fatal error while dropping SessionCursorSender. \
                This should not happen. {}",
                err
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[tokio::test]
    async fn test_two_clients() {
        let cursors = Cursors::new();

        let mut session0 = cursors.new_session(1000).unwrap();
        // we can recv immediately on a new session
        assert_eq!(
            serde_json::to_value(session0.rx.recv().await.unwrap()).unwrap(),
            json!({})
        );

        let mut session1 = cursors.new_session(1001).unwrap();

        session0.tx.update(serde_json::from_value(json!([1, 2, 3])).unwrap()).unwrap();
        session1.tx.update(serde_json::from_value(json!([4, 5, 6])).unwrap()).unwrap();
        assert_eq!(
            serde_json::to_value(session0.rx.recv().await.unwrap()).unwrap(),
            json!({"1": [4, 5, 6]})
        );
        assert_eq!(
            serde_json::to_value(session1.rx.recv().await.unwrap()).unwrap(),
            json!({"0": [1, 2, 3]})
        );
    }
}
