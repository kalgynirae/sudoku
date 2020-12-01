use futures::prelude::*;
use log::error;
use std::convert::TryInto;
use std::error::Error;
use std::fmt;

use crate::config::DatabaseConfig;
use crate::global_state::GlobalState;
use crate::room::{RoomId, RoomState};

// we can't use sqlx::Any because that's incompatible with the query!() macro, but we can at least
// alias the type so it's easier to swap out with mysql or postgres later.
type Database = sqlx::Sqlite;
pub type Pool = sqlx::Pool<Database>;
pub type SqlxError = sqlx::Error;

pub async fn new_pool(config: &DatabaseConfig) -> Result<Pool, SqlxError> {
    let pool = sqlx::Pool::connect(&config.uri).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn writeback(pool: &Pool, global_state: &GlobalState) -> Result<(), SqlxError> {
    // Use a transaction to avoid having to flush every write to disk individually. This could be
    // a large transaction, so it might make sense to chunk the work up in the future to reduce
    // memory usage.
    let mut tx = pool.begin().await?;

    let param_stream = stream::iter(global_state.get_dirty_rooms().await.into_iter())
        .map(|(room_id, rs_mutex)| async move {
            let mut rs = rs_mutex.lock().await;
            // Clear the dirty flag since we'll write this to the database soon. Yes, we're
            // acknowledging a write before it happens, but this whole service is best-effort
            // so it doesn't really matter.
            rs.dirty = false;
            let room_id_blob = u128::from(room_id).to_ne_bytes();
            let board_blob: [u8; 81 * 6] = rs.sql_serialize();
            // Just return the serialized parameters here, don't try to call .execute(tx),
            // since tx would need to be Copy, and &mut Transaction<> isn't Copy.
            Some((room_id, room_id_blob, board_blob))
        })
        // Try to do a few reads concurrently to avoid hanging on a single locked room mutex
        .buffer_unordered(5)
        .filter_map(|el| async move { el });

    tokio::pin!(param_stream);

    while let Some((room_id, room_id_blob, board_blob)) = param_stream.next().await {
        // convert these into unsized slices
        let room_id_blob = &room_id_blob[..];
        let board_blob = &board_blob[..];
        let result = sqlx::query!(
            "insert or replace into rooms (id, board) values (?, ?)",
            room_id_blob,
            board_blob,
        )
        .execute(&mut tx)
        .await;
        if let Err(err) = result {
            error!("Failed to write room {} back to database: {}", room_id, err);
            // don't return an error, that would kill the rest of the transaction
        }
    }
    tx.commit().await?;
    Ok(())
}

pub async fn read_room(pool: &Pool, room_id: RoomId) -> Result<Option<RoomState>, ReadRoomError> {
    let room_id_blob = u128::from(room_id).to_ne_bytes();
    let room_id_blob = &room_id_blob[..];
    let board_blob: Option<[u8; 81 * 6]> =
        sqlx::query!("select board from rooms where id = ?", room_id_blob)
            .fetch_optional(pool)
            .await?
            .map(|row| row.board.try_into())
            .transpose()
            .map_err(|_| ReadRoomError::Deserialization("board blob was the wrong size"))?;
    board_blob
        .map(|bb| RoomState::sql_deserialize(room_id, &bb))
        .transpose()
        .map_err(|err| ReadRoomError::Deserialization(err))
}

#[derive(Debug)]
pub enum ReadRoomError {
    Deserialization(&'static str),
    Sqlx(SqlxError),
}

impl fmt::Display for ReadRoomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Deserialization(err) => write!(f, "{}", err),
            Self::Sqlx(err) => write!(f, "{}", err),
        }
    }
}

impl Error for ReadRoomError {}

impl From<sqlx::Error> for ReadRoomError {
    fn from(err: sqlx::Error) -> Self {
        Self::Sqlx(err)
    }
}
