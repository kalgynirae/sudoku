use serde::{Deserialize, Serialize};

use crate::digit::{Digit, DigitBitFlags};
use crate::error::SudokuError;

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSquare {
    pub number: Option<Digit>,
    pub corners: DigitBitFlags,
    pub centers: DigitBitFlags,
    pub locked: bool,
}

impl BoardSquare {
    fn apply(&mut self, diff: &BoardDiffOperation) {
        if self.locked {
            return;
        }
        match *diff {
            BoardDiffOperation::SetNumber { digit } => {
                self.number = digit;
            }
            BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Centers,
                digit,
            } => {
                self.centers.insert(digit);
            }
            BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Corners,
                digit,
            } => {
                self.corners.insert(digit);
            }
            BoardDiffOperation::RemovePencilMark {
                r#type: BoardPencilType::Centers,
                digit,
            } => {
                self.centers.remove(digit);
            }
            BoardDiffOperation::RemovePencilMark {
                r#type: BoardPencilType::Corners,
                digit,
            } => {
                self.corners.remove(digit);
            }
            BoardDiffOperation::ClearPencilMarks {
                r#type: BoardPencilType::Centers,
            } => {
                self.centers = Default::default();
            }
            BoardDiffOperation::ClearPencilMarks {
                r#type: BoardPencilType::Corners,
            } => {
                self.corners = Default::default();
            }
        }
    }

    #[cfg(feature = "sql")]
    pub fn sql_serialize(&self) -> [u8; 6] {
        let number = self.number.map(|v| v.into()).unwrap_or(0);
        let corners = self.corners.sql_serialize();
        let centers = self.centers.sql_serialize();
        let locked = self.locked.into();
        [
            number, corners[0], corners[1], centers[0], centers[1], locked,
        ]
    }

    #[cfg(feature = "sql")]
    pub fn sql_deserialize(bytes: &[u8; 6]) -> Result<Self, &'static str> {
        use std::convert::TryFrom;

        Ok(BoardSquare {
            number: match bytes[0] {
                0 => None,
                num => Some(Digit::try_from(num)?),
            },
            corners: DigitBitFlags::sql_deserialize([bytes[1], bytes[2]]),
            centers: DigitBitFlags::sql_deserialize([bytes[3], bytes[4]]),
            locked: match bytes[5] {
                0 => false,
                1 => true,
                _ => return Err("locked must be 0 or 1"),
            },
        })
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardState {
    squares: Vec<BoardSquare>,
}

impl BoardState {
    pub fn apply(&mut self, diff: &BoardDiff) -> Result<(), SudokuError> {
        if diff.squares.len() > self.squares.len() {
            // not strictly needed, but provide a sanity check
            return Err(SudokuError::TooManySquares(
                diff.squares.len(),
                self.squares.len(),
            ));
        }
        for sq_idx in &diff.squares {
            self.squares
                .get_mut(*sq_idx as usize)
                .ok_or(SudokuError::InvalidSquareIndex(*sq_idx as usize))?
                .apply(&diff.operation);
        }
        Ok(())
    }

    #[cfg(feature = "sql")]
    pub fn sql_serialize(&self) -> [u8; 81 * 6] {
        use std::convert::TryInto;

        let mut result = Vec::with_capacity(81 * 6);
        for sq in self.squares.iter() {
            result.extend_from_slice(&sq.sql_serialize());
        }
        // use expect() assuming `self.squares` can't be malformed since it's an internal
        // datastructure
        result
            .try_into()
            .expect("return value of sql_serialize must match the size of the serialized squares")
    }

    #[cfg(feature = "sql")]
    pub fn sql_deserialize(bytes: &[u8; 81 * 6]) -> Result<Self, &'static str> {
        use std::convert::TryInto;

        let squares: Vec<BoardSquare> = bytes
            .chunks_exact(6)
            .map(|b| {
                BoardSquare::sql_deserialize(b.try_into().or(Err("all squares should be 6 bytes"))?)
            })
            .collect::<Result<_, _>>()?;
        if squares.len() != 81 {
            return Err("expected 81 squares when deserializing sql");
        }
        Ok(BoardState { squares })
    }
}

impl Default for BoardState {
    fn default() -> BoardState {
        BoardState {
            squares: (0..81).map(|_| Default::default()).collect(),
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardDiff {
    pub squares: Vec<u8>,
    pub operation: BoardDiffOperation,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BoardPencilType {
    Centers,
    Corners,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "fn", rename_all = "camelCase")]
pub enum BoardDiffOperation {
    #[serde(rename_all = "camelCase")]
    SetNumber { digit: Option<Digit> },
    #[serde(rename_all = "camelCase")]
    AddPencilMark {
        r#type: BoardPencilType,
        digit: Digit,
    },
    #[serde(rename_all = "camelCase")]
    RemovePencilMark {
        r#type: BoardPencilType,
        digit: Digit,
    },
    #[serde(rename_all = "camelCase")]
    ClearPencilMarks { r#type: BoardPencilType },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(feature = "sql")]
    fn board_state_sql_serialize_deserialize() {
        let mut bs = BoardState::default();
        bs.apply(&BoardDiff {
            squares: vec![0, 1, 2, 3],
            operation: BoardDiffOperation::SetNumber {
                digit: Some(Digit::D5),
            },
        })
        .unwrap();
        bs.apply(&BoardDiff {
            squares: vec![4, 5, 6, 7],
            operation: BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Centers,
                digit: Digit::D1,
            },
        })
        .unwrap();
        bs.apply(&BoardDiff {
            squares: vec![8, 9],
            operation: BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Corners,
                digit: Digit::D2,
            },
        })
        .unwrap();
        assert_eq!(
            BoardState::sql_deserialize(&bs.sql_serialize()).unwrap(),
            bs
        );
    }
}
