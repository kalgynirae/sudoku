use serde::{Deserialize, Serialize};
use std::convert::TryFrom;

/// An enum that ensures that digits are in a safe range.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(into = "u8", try_from = "u8")]
#[repr(u8)]
pub enum Digit {
    D1 = 1,
    D2,
    D3,
    D4,
    D5,
    D6,
    D7,
    D8,
    D9,
}

impl TryFrom<u8> for Digit {
    type Error = &'static str;

    fn try_from(val: u8) -> Result<Digit, Self::Error> {
        Ok(match val {
            1 => Digit::D1,
            2 => Digit::D2,
            3 => Digit::D3,
            4 => Digit::D4,
            5 => Digit::D5,
            6 => Digit::D6,
            7 => Digit::D7,
            8 => Digit::D8,
            9 => Digit::D9,
            _ => Err("digit is out of range")?,
        })
    }
}

impl Into<u8> for Digit {
    fn into(self: Digit) -> u8 {
        self as u8
    }
}

/// A set of all possible Digit values stored with bitflags on a u16, making it much cheaper than a
/// normal set.
#[derive(Clone, Copy, Debug, Deserialize, Default, Eq, PartialEq, Serialize)]
#[serde(into = "Vec<Digit>", from = "Vec<Digit>")]
pub struct DigitBitFlags(u16);

impl DigitBitFlags {
    pub fn contains_u8(&self, value: u8) -> bool {
        (1u16 << value as u16) & self.0 != 0
    }

    #[allow(dead_code)]
    pub fn contains(&self, value: Digit) -> bool {
        self.contains_u8(value.into())
    }

    pub fn insert(&mut self, value: Digit) {
        self.0 |= 1u16 << (value as u16);
    }

    pub fn remove(&mut self, value: Digit) {
        self.0 &= !(1u16 << (value as u16));
    }

    #[cfg(feature = "sql")]
    pub fn sql_serialize(&self) -> [u8; 2] {
        self.0.to_ne_bytes()
    }

    #[cfg(feature = "sql")]
    pub fn sql_deserialize(bytes: [u8; 2]) -> Self {
        DigitBitFlags(u16::from_ne_bytes(bytes))
    }
}

// this conversion is mostly just for serialization/deserialization
impl Into<Vec<Digit>> for DigitBitFlags {
    fn into(self) -> Vec<Digit> {
        let mut result = Vec::with_capacity(self.0.count_ones() as usize);
        for i in 1..=9 {
            if self.contains_u8(i) {
                result.push(Digit::try_from(i).unwrap());
            }
        }
        result
    }
}

impl From<Vec<Digit>> for DigitBitFlags {
    fn from(vec: Vec<Digit>) -> DigitBitFlags {
        let mut flags: DigitBitFlags = Default::default();
        for el in vec {
            flags.insert(el);
        }
        flags
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn serde_serialize() {
        assert_eq!(
            serde_json::to_value(DigitBitFlags::default()).unwrap(),
            json!([])
        );
        assert_eq!(
            serde_json::to_value(DigitBitFlags::from(vec![
                Digit::D1,
                Digit::D2,
                Digit::D3,
                Digit::D8,
                Digit::D9
            ]))
            .unwrap(),
            json!([1, 2, 3, 8, 9])
        );
    }

    #[test]
    fn serde_deserialize() {
        assert_eq!(
            serde_json::from_value::<DigitBitFlags>(json!([])).unwrap(),
            DigitBitFlags::default(),
        );
        assert_eq!(
            serde_json::from_value::<DigitBitFlags>(json!([1, 2, 3, 8, 9])).unwrap(),
            DigitBitFlags::from(vec![Digit::D1, Digit::D2, Digit::D3, Digit::D8, Digit::D9])
        );
    }

    #[test]
    #[cfg(feature = "sql")]
    fn sql_serialize_deserialize() {
        // just check that this round-trips, we don't really care about the actual value it
        // serializes to/from
        for flags_raw in vec![
            vec![],
            vec![Digit::D1, Digit::D2, Digit::D3, Digit::D8, Digit::D9],
        ] {
            let flags = DigitBitFlags::from(flags_raw);
            assert_eq!(DigitBitFlags::sql_deserialize(flags.sql_serialize()), flags);
        }
    }
}
