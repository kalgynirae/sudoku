use serde::de::{self, Deserialize, Deserializer, SeqAccess, Unexpected, Visitor};
use serde::ser::{self, Serialize, SerializeSeq, Serializer};
use std::fmt;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CursorSelection {
    // there are 81 squares, so we can cram all of them into a u128
    square_bit_flags: u128,
}

impl CursorSelection {
    pub fn new() -> Self {
        CursorSelection {
            square_bit_flags: 0,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.square_bit_flags == 0
    }
}

impl Serialize for CursorSelection {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if self.square_bit_flags >> 81 != 0 {
            return Err(ser::Error::custom(
                "CursorSelection contains an invalid high bit",
            ));
        }
        let sbf = self.square_bit_flags;
        let len = sbf.count_ones() as usize;
        let mut seq = serializer.serialize_seq(Some(len))?;
        if len == 0 {
            return seq.end();
        }
        for i in 0..81 {
            if (1 << i) & sbf != 0 {
                seq.serialize_element(&i)?;
            }
        }
        seq.end()
    }
}

impl<'de> Deserialize<'de> for CursorSelection {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_seq(CursorSelectionVisitor)
    }
}

struct CursorSelectionVisitor;

impl<'de> Visitor<'de> for CursorSelectionVisitor {
    type Value = CursorSelection;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("an sequence of unsigned integer indexes less than 81")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut square_bit_flags = 0;
        while let Some(el) = seq.next_element::<u8>()? {
            if el < 81 {
                square_bit_flags |= 1 << el;
            } else {
                return Err(de::Error::invalid_value(
                    Unexpected::Unsigned(el.into()),
                    &"an unsigned integer index less than 81",
                ));
            }
        }
        Ok(CursorSelection { square_bit_flags })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn test_serialize() {
        assert_eq!(
            serde_json::to_value(&CursorSelection {
                square_bit_flags: 0
            })
            .unwrap(),
            json!([])
        );
        assert_eq!(
            serde_json::to_value(&CursorSelection {
                square_bit_flags: 0b10101
            })
            .unwrap(),
            json!([0, 2, 4])
        );
        assert_eq!(
            serde_json::to_value(&CursorSelection {
                square_bit_flags: 1 << 80
            })
            .unwrap(),
            json!([80])
        );
        assert!(serde_json::to_value(&CursorSelection {
            square_bit_flags: 1 << 81
        })
        .is_err());
    }

    #[test]
    fn test_deserialize() {
        assert_eq!(
            serde_json::from_value::<CursorSelection>(json!([])).unwrap(),
            CursorSelection {
                square_bit_flags: 0
            },
        );
        assert_eq!(
            serde_json::from_value::<CursorSelection>(json!([0, 2, 4])).unwrap(),
            CursorSelection {
                square_bit_flags: 0b10101
            },
        );
        assert_eq!(
            serde_json::from_value::<CursorSelection>(json!([80])).unwrap(),
            CursorSelection {
                square_bit_flags: 1 << 80
            },
        );
        assert!(serde_json::from_value::<CursorSelection>(json!([81])).is_err());
    }
}
