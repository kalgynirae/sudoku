use std::error::Error;
use std::fmt;

use crate::config::DatabaseConfig;
use crate::global_state::GlobalState;

pub type Pool = ();

#[derive(Debug)]
pub struct SqlxError;

impl fmt::Display for SqlxError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("sql::stub::SqlxError")
    }
}

impl Error for SqlxError {}

pub async fn new_pool(_config: &DatabaseConfig) -> Result<Pool, SqlxError> {
    Ok(())
}

pub async fn writeback(_pool: &Pool, _global_state: &GlobalState) -> Result<(), SqlxError> {
    panic!("writeback shouldn't be called when compiled without sql feature");
}

#[derive(Debug)]
pub struct ReadRoomError;

impl fmt::Display for ReadRoomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("sql::stub::ReadRoomError")
    }
}

impl Error for ReadRoomError {}
