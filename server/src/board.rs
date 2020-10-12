use crate::digit::{Digit, DigitBitFlags};
use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSquare {
    pub number: Option<Digit>,
    pub corners: DigitBitFlags,
    pub centers: DigitBitFlags,
    pub locked: bool,
}

impl BoardSquare {
    fn apply(&mut self, diff: &BoardDiffOperation) {
        match *diff {
            BoardDiffOperation::SetNumber { digit } => {
                self.number = digit;
            }
            BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Center,
                digit,
            } => {
                self.centers.insert(digit);
            }
            BoardDiffOperation::AddPencilMark {
                r#type: BoardPencilType::Corner,
                digit,
            } => {
                self.corners.insert(digit);
            }
            BoardDiffOperation::RemovePencilMark {
                r#type: BoardPencilType::Center,
                digit,
            } => {
                self.centers.remove(digit);
            }
            BoardDiffOperation::RemovePencilMark {
                r#type: BoardPencilType::Corner,
                digit,
            } => {
                self.corners.remove(digit);
            }
            BoardDiffOperation::ClearPencilMarks {
                r#type: BoardPencilType::Center,
            } => {
                self.centers = Default::default();
            }
            BoardDiffOperation::ClearPencilMarks {
                r#type: BoardPencilType::Corner,
            } => {
                self.corners = Default::default();
            }
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardState {
    pub squares: Vec<BoardSquare>,
}

impl BoardState {
    pub fn apply(&mut self, diff: &BoardDiff) -> Result<(), &'static str> {
        if diff.squares.len() > self.squares.len() {
            // not strictly needed, but provide a sanity check
            return Err("a diff can't contain more than 81 squares");
        }
        for sq_idx in &diff.squares {
            self.squares
                .get_mut(*sq_idx as usize)
                .ok_or("got invalid index")?
                .apply(&diff.operation);
        }
        Ok(())
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
    Center,
    Corner,
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
