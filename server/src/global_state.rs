#[cfg(feature = "sql")]
use futures::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::room::{RoomId, RoomState};
use crate::sql;

#[cfg(feature = "sql")]
type PendingRoomState = future::WeakShared<
    future::BoxFuture<'static, Result<Option<Arc<Mutex<RoomState>>>, Arc<sql::ReadRoomError>>>,
>;

#[derive(Default)]
pub struct GlobalState {
    // TODO: rooms are never cleaned up. We need to GC them and move them to a database
    rooms: RwLock<HashMap<RoomId, Arc<Mutex<RoomState>>>>,
    /// Room futures that we're currently reading from. This is used to avoid a (small) thundering
    /// herd problem where we read the same room from SQL multiple times.
    // TODO: Periodically clean out dead WeakShared refs during GC.
    #[cfg(feature = "sql")]
    pending_rooms: Mutex<HashMap<RoomId, PendingRoomState>>,
}

impl GlobalState {
    pub async fn insert_room(&self, room_id: RoomId, room_state: Arc<Mutex<RoomState>>) {
        self.rooms.write().await.insert(room_id, room_state);
    }

    /// Attempts to read the room from memory. If not found, it returns None. To fall back to
    /// reading from SQL, enable the "sql" feature for this crate. This requires a stub 'pool'
    /// argument and returns a Result to match the type signature of the sql-enabled version.
    #[cfg(not(feature = "sql"))]
    pub async fn get_room(
        self: &Arc<Self>,
        _db_pool: &Arc<sql::Pool>,
        room_id: &RoomId,
    ) -> Result<Option<Arc<Mutex<RoomState>>>, Arc<sql::ReadRoomError>> {
        Ok(self.rooms.read().await.get(room_id).cloned())
    }

    /// Attempts to read the room from memory, falling back to doing a lookup from SQL if it
    /// doesn't exist in memory.
    #[cfg(feature = "sql")]
    pub async fn get_room(
        self: &Arc<Self>,
        db_pool: &Arc<sql::Pool>,
        room_id: &RoomId,
    ) -> Result<Option<Arc<Mutex<RoomState>>>, Arc<sql::ReadRoomError>> {
        let rooms_read_guard = self.rooms.read().await;
        if let Some(room) = rooms_read_guard.get(room_id) {
            return Ok(Some(room.clone()));
        }

        // Failed to read a completed room.
        let mut pending_rooms_guard = self.pending_rooms.lock().await;

        // If there's an existing future, just use that
        let read_room_fut_opt = pending_rooms_guard
            .get(room_id)
            .and_then(|weak_fut| weak_fut.upgrade());

        // If we failed to find a future, make a new one
        let read_room_fut = match read_room_fut_opt {
            Some(fut) => fut,
            None => {
                // there's no future for this yet, make a new one and put it in pending_rooms
                let fut = {
                    let room_id = *room_id;
                    let self_arc = self.clone();
                    let db_pool = db_pool.clone();
                    async move {
                        let room = sql::read_room(&db_pool, room_id)
                            .await
                            .map(|rs| rs.map(|rs| Arc::new(Mutex::new(rs))))
                            .map_err(Arc::new);
                        if let Ok(Some(room)) = room.clone() {
                            self_arc.rooms.write().await.insert(room_id, room);
                        }
                        room
                    }
                };
                let shared_fut = fut.boxed().shared();
                pending_rooms_guard.insert(
                    *room_id,
                    shared_fut
                        .downgrade()
                        .expect("read_room_fut shouldn't have been polled yet"),
                );
                shared_fut
            }
        };

        // Release the locks
        drop(rooms_read_guard);
        drop(pending_rooms_guard);

        // Run the sql query
        read_room_fut.await
    }

    /// Gets a vec of all the dirty rooms that need to be written back to disk. This is an
    /// expensive operation and will take a read lock on the data structure for some period of
    /// time.
    ///
    /// Eventually, this could be made more efficient by putting dirty rooms into a list when they
    /// become dirty, that way we wouldn't have to grab a lock on every room to read the dirty
    /// status.
    #[cfg(feature = "sql")]
    pub async fn get_dirty_rooms(&self) -> Vec<(RoomId, Arc<Mutex<RoomState>>)> {
        // copy room info out of the HashMap as quickly as possible to avoid holding the RwLock
        let room_map_guard = self.rooms.read().await;
        let room_vec: Vec<_> = room_map_guard
            .iter()
            .map(|(room_id, room_state)| (*room_id, room_state.clone()))
            .collect();
        // release the global data lock
        drop(room_map_guard);

        // filter room_vec by grabbing the lock on every room and checking the dirty flag
        stream::iter(room_vec.into_iter())
            .map(|(room_id, rs_mutex)| async move {
                if rs_mutex.lock().await.dirty {
                    Some((room_id, rs_mutex))
                } else {
                    None
                }
            })
            // Try to do a few reads concurrently to avoid hanging on a single locked room mutex
            .buffer_unordered(5)
            .filter_map(|el| async move { el })
            .collect()
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::iter;

    use super::*;
    use crate::config::DatabaseConfig;

    fn mock_database_config() -> DatabaseConfig {
        DatabaseConfig {
            uri: "sqlite::memory:".to_owned(),
        }
    }

    async fn mock_database_pool() -> Arc<sql::Pool> {
        Arc::new(sql::new_pool(&mock_database_config()).await.unwrap())
    }

    #[tokio::test]
    #[cfg(feature = "sql")]
    async fn dirty_rooms() {
        let room_ids: Vec<_> = iter::repeat_with(RoomId::random).take(20).collect();
        let mut rooms: Vec<_> = room_ids.iter().map(|rid| RoomState::new(*rid)).collect();

        // newly constructed rooms are dirty
        assert!(rooms[0].dirty);

        // clear the dirty flags
        for r in rooms.iter_mut() {
            r.dirty = false;
        }

        // an empty vec of diffs doesn't actually change the board, but is good enough to mark it
        // as dirty
        rooms[0].apply_diffs(0, 0, vec![]).unwrap();
        rooms[1].apply_diffs(0, 0, vec![]).unwrap();
        rooms[2].apply_diffs(0, 0, vec![]).unwrap();
        rooms[10].apply_diffs(0, 0, vec![]).unwrap();

        let gs = GlobalState::default();
        for r in rooms {
            gs.insert_room(r.room_id, Arc::new(Mutex::new(r))).await;
        }

        let dirty_room_ids: HashSet<_> = gs
            .get_dirty_rooms()
            .await
            .iter()
            .map(|(rid, _)| *rid)
            .collect();

        assert_eq!(
            dirty_room_ids,
            vec![room_ids[0], room_ids[1], room_ids[2], room_ids[10]]
                .iter()
                .cloned()
                .collect()
        );
    }

    #[tokio::test(threaded_scheduler)]
    async fn get_room_missing() {
        let db_pool = mock_database_pool().await;
        let gs = Arc::new(GlobalState::default());
        assert!(matches!(
            gs.get_room(&db_pool, &RoomId::random()).await,
            Ok(None)
        ));
    }

    #[tokio::test(threaded_scheduler)]
    async fn get_room_local() {
        let db_pool = mock_database_pool().await;
        let gs = Arc::new(GlobalState::default());
        let room_id = RoomId::random();

        let room_state_inserted = Arc::new(Mutex::new(RoomState::new(room_id)));
        gs.insert_room(room_id, room_state_inserted.clone()).await;

        let room_state_read = gs.get_room(&db_pool, &room_id).await.unwrap().unwrap();

        // these are the same by identity
        assert!(Arc::ptr_eq(&room_state_inserted, &room_state_read));
    }

    #[tokio::test(threaded_scheduler)]
    #[cfg(feature = "sql")]
    async fn get_room_from_sql() {
        let db_pool = mock_database_pool().await;
        let gs = Arc::new(GlobalState::default());
        let room_id = RoomId::random();

        let room_state_inserted = Arc::new(Mutex::new(RoomState::new(room_id)));
        gs.insert_room(room_id, room_state_inserted.clone()).await;

        // writeback, then drop the global state
        sql::writeback(&db_pool, &gs).await.unwrap();
        drop(gs);

        // make a new (empty) global state
        let gs = Arc::new(GlobalState::default());
        let room_state_read = gs.get_room(&db_pool, &room_id).await.unwrap().unwrap();

        // these are different by identity, because we deserialized it from sql
        assert!(!Arc::ptr_eq(&room_state_inserted, &room_state_read));
        // however, the room id matches
        assert_eq!(
            room_state_inserted.lock().await.room_id,
            room_state_read.lock().await.room_id
        );
    }
}
