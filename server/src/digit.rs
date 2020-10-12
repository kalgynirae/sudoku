use serde::{Deserialize, Serialize};
use std::convert::TryFrom;

/// An enum that ensures that digits are in a safe range.
#[derive(Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
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
#[derive(Clone, Copy, Deserialize, Default, Serialize)]
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
