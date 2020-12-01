use once_cell::sync::Lazy;
use std::error::Error;
use std::fmt::{self, Write};
use std::str::FromStr;

// Alphanumerics, excluding ilIoO01, since they look too similar.
static ROOM_ID_CHARS: Lazy<Vec<char>> = Lazy::new(|| {
    "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"
        .chars()
        .collect()
});

#[derive(Copy, Clone, Debug, Eq, Hash, PartialEq)]
pub struct RoomId(u128);

impl RoomId {
    pub fn random() -> RoomId {
        RoomId(rand::random())
    }
}

impl fmt::Display for RoomId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // use a prefix ("r") to allow us to detect possible future changes to this format
        f.write_char('r')?;
        let len: u128 = ROOM_ID_CHARS.len() as u128;
        let mut rest = self.0;
        while rest > 0 {
            f.write_char(ROOM_ID_CHARS[(rest % len) as usize])?;
            rest /= len;
        }
        Ok(())
    }
}

impl FromStr for RoomId {
    type Err = InvalidRoomIdError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let err_fn = || InvalidRoomIdError(s.to_owned());
        let mut iter = s.chars();
        match iter.next() {
            Some('r') => {}
            Some(_) | None => {
                return Err(err_fn());
            }
        }
        let mut coefficient: Option<u128> = Some(1);
        let mut result: u128 = 0;
        for ch in iter {
            match ROOM_ID_CHARS.binary_search(&ch) {
                Ok(idx) => {
                    if let Some(coeff) = coefficient {
                        result += (idx as u128).checked_mul(coeff).ok_or_else(err_fn)?;
                        coefficient = coeff.checked_mul(ROOM_ID_CHARS.len() as u128);
                    } else {
                        return Err(err_fn());
                    }
                }
                Err(_) => {
                    return Err(err_fn());
                }
            }
        }
        Ok(RoomId(result))
    }
}

impl From<RoomId> for u128 {
    fn from(val: RoomId) -> u128 {
        val.0
    }
}

#[derive(Debug, Eq, PartialEq)]
pub struct InvalidRoomIdError(String);

impl fmt::Display for InvalidRoomIdError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?} is not a valid room id", self.0)
    }
}

impl Error for InvalidRoomIdError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_id_chars_is_sorted() {
        // Vec::is_sorted is a nightly-only stdlib API, so just sort and compare
        let mut chars_sorted = ROOM_ID_CHARS.clone();
        chars_sorted.sort();
        assert_eq!(*ROOM_ID_CHARS, chars_sorted);
    }

    #[test]
    fn conversion_from_str() {
        assert_eq!(
            "r3BvXyfHXQkM8N4AeVdJZPd".parse::<RoomId>().unwrap().0,
            124888837662232996869396112214390934746
        );
        assert_eq!(
            "3BvXyfHXQkM8N4AeVdJZPd".parse::<RoomId>(),
            Err(InvalidRoomIdError("3BvXyfHXQkM8N4AeVdJZPd".to_owned()))
        );
        assert_eq!(
            RoomId::from_str("r spaces are invalid"),
            Err(InvalidRoomIdError("r spaces are invalid".to_owned()))
        );
    }

    #[test]
    fn conversion_to_str() {
        assert_eq!(
            RoomId(124888837662232996869396112214390934746).to_string(),
            "r3BvXyfHXQkM8N4AeVdJZPd"
        );
    }

    #[test]
    fn conversion_back_and_forth() {
        for idx in 0..10000 {
            assert_eq!(RoomId(idx).to_string().parse::<RoomId>().unwrap().0, idx);
        }
    }

    #[test]
    fn max_int() {
        assert_eq!(
            RoomId(u128::MAX).to_string().parse::<RoomId>().unwrap().0,
            u128::MAX
        );
    }

    #[test]
    fn overflow() {
        // this is a valid room id format
        assert!("rzzzz".parse::<RoomId>().is_ok());
        // but too many 'z' characters eventually causes an overflow
        assert_eq!(
            "rzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".parse::<RoomId>(),
            Err(InvalidRoomIdError(
                "rzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".to_owned()
            ))
        );
    }
}
