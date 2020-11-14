use serde::{Serialize, Serializer};
use std::error::Error;
use std::fmt;

#[derive(Debug)]
#[non_exhaustive]
pub enum SudokuError {
    InvalidSquareIndex(usize),
    ReceivedBinaryMessage,
    RoomFull(usize),
    SerdeJson(serde_json::Error),
    TooManyBoardDiffs(usize, usize),
    TooManySquares(usize, usize),

    // Internal errors should never happen.
    Internal(Box<dyn Error + Sync + Send>),
}

impl fmt::Display for SudokuError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SudokuError::InvalidSquareIndex(idx) => {
                write!(f, "Got a diff containing an index of {}, which is out of bounds.", idx)
            }
            SudokuError::ReceivedBinaryMessage => {
                write!(f, "Messages must be JSON-encoded text, not binary blobs.")
            }
            SudokuError::RoomFull(max_count) => write!(
                f,
                "This room is full. No more than {} connections are allowed to a single room.",
                max_count
            ),
            SudokuError::SerdeJson(err) => write!(f, "Request could not be parsed: {}", err),
            SudokuError::TooManyBoardDiffs(count, max_count) => write!(
                f,
                "Got {} diffs in a request, but there is a maximum of {} diffs per request.",
                count, max_count
            ),
            SudokuError::TooManySquares(count, max_count) => write!(
                f,
                "Received a diff containing {} squares, but a diff can't contain more than {} squares.",
                count, max_count
            ),
            SudokuError::Internal(_) => write!(f, "Internal Error"),
        }
    }
}

impl Serialize for SudokuError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl Error for SudokuError {}
