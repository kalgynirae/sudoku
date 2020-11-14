use serde::ser::{Serialize, SerializeMap, Serializer};

use crate::cursors::error::CursorUpdateError;
use crate::cursors::selection::CursorSelection;
use crate::room::MAX_SESSIONS_PER_ROOM;

type SessionId = u64;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CursorsMapIndex(usize);

// This needs to be relatively cheap to copy so that we can reasonably debounce and then compare
// (for equality) the results we send to the client.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CursorsMap {
    // MAX_SESSIONS_PER_ROOM is small, so don't use a real map or even waste a heap allocation on a
    // Vec.
    //
    // We need to make sure that the iteration order is the same every time so that equality works.
    // Since the entry lives as long as the SessionId does, we don't need to worry about
    // insert/removal changing order.
    inner: [Option<(SessionId, CursorSelection)>; MAX_SESSIONS_PER_ROOM],
}

impl CursorsMap {
    pub fn new() -> Self {
        CursorsMap {
            inner: Default::default(),
        }
    }

    pub fn new_session(
        &mut self,
        session_id: SessionId,
    ) -> Result<CursorsMapIndex, CursorUpdateError> {
        let mut idx = None;
        // find a free slot and pick that idx
        for (iter_idx, entry) in self.inner.iter().enumerate() {
            if entry.is_none() {
                idx = Some(iter_idx);
                break;
            }
        }
        match idx {
            Some(idx) => {
                self.inner[idx] = Some((session_id, CursorSelection::new()));
                Ok(CursorsMapIndex(idx))
            }
            None => Err(CursorUpdateError::Full),
        }
    }

    pub fn update(
        &mut self,
        idx: CursorsMapIndex,
        selection: CursorSelection,
    ) -> Result<(), CursorUpdateError> {
        if let Some(ref mut entry) = self.inner[idx.0] {
            entry.1 = selection;
            Ok(())
        } else {
            Err(CursorUpdateError::InvalidIndex(idx))
        }
    }

    pub fn remove(&mut self, idx: CursorsMapIndex) -> Result<(), CursorUpdateError> {
        let entry = &mut self.inner[idx.0];
        if entry.is_some() {
            *entry = None;
            Ok(())
        } else {
            Err(CursorUpdateError::InvalidIndex(idx))
        }
    }

    pub fn into_view(self, idx: CursorsMapIndex) -> CursorsMapView {
        CursorsMapView { map: self, idx }
    }
}

pub struct CursorsMapView {
    pub(super) map: CursorsMap,
    pub(super) idx: CursorsMapIndex,
}

impl Serialize for CursorsMapView {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // we can compute size, but not without keeping a counter in CursorsMap or traversing the
        // map twice, and serde_json probably doesn't get much benefit from a size.
        let mut s_map = serializer.serialize_map(None)?;
        for (idx, entry) in self.map.inner.iter().enumerate() {
            if idx != self.idx.0 {
                if let Some((_k, v)) = entry {
                    if !v.is_empty() {
                        s_map.serialize_entry(&idx, v)?;
                    }
                }
            }
        }
        s_map.end()
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn test_empty_view() {
        let mut map = CursorsMap::new();
        let idx = map.new_session(1234).unwrap();
        assert_eq!(
            serde_json::to_value(&map.into_view(idx)).unwrap(),
            json!({}),
        );
    }

    #[test]
    fn test_two_clients() {
        let mut map = CursorsMap::new();
        let idx0 = map.new_session(1234).unwrap();
        let idx1 = map.new_session(4321).unwrap();
        map.update(
            idx0,
            serde_json::from_value::<CursorSelection>(json!([1, 2, 3])).unwrap(),
        )
        .unwrap();
        map.update(
            idx1,
            serde_json::from_value::<CursorSelection>(json!([4, 5, 6])).unwrap(),
        )
        .unwrap();
        // the view for idx0 shows the results for idx1
        assert_eq!(
            serde_json::to_value(&map.clone().into_view(idx0)).unwrap(),
            json!({"1": [4, 5, 6]}),
        );
        // and the view for idx1 shows the results for idx0
        assert_eq!(
            serde_json::to_value(&map.clone().into_view(idx1)).unwrap(),
            json!({"0": [1, 2, 3]}),
        );
    }

    #[test]
    fn test_full_map() {
        let mut map = CursorsMap::new();
        let valid_sessions: Vec<CursorsMapIndex> = (0..MAX_SESSIONS_PER_ROOM)
            .map(|session_id| map.new_session(session_id as SessionId).unwrap())
            .collect();
        assert!(matches!(
            map.new_session(1000),
            Err(CursorUpdateError::Full)
        ));

        // if we remove an entry from a full map and then call new_session, we get the index we
        // just removed
        map.remove(valid_sessions[0]).unwrap();
        assert_eq!(map.new_session(1000).unwrap(), valid_sessions[0],);
    }
}
