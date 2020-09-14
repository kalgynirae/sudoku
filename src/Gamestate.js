export const EMPTY_GAME_STATE = {
  numbers: new Array(81).fill(null),
  corners: new Array(81).fill(new Set()),
  centers: new Array(81).fill(new Set()),
};

export function anyContains(substate, squares, digit) {
  for (let i of squares) {
    if (substate[i].has(digit)) return true;
  }
  return false;
}

export function setNumber(state, squares, digit) {
  const newstate = { ...state };
  newstate.numbers = [...state.numbers];
  for (let i of squares) {
    newstate.numbers[i] = digit;
  }
  return newstate;
}

export function addHint(substate, squares, digit) {
  const newsubstate = [...substate];
  for (let i of squares) {
    if (!substate[i].has(digit)) {
      newsubstate[i] = new Set(substate[i]);
      newsubstate[i].add(digit);
    }
  }
  return newsubstate;
}

export function removeHint(substate, squares, digit) {
  const newsubstate = [...substate];
  for (let i of squares) {
    if (substate[i].has(digit)) {
      newsubstate[i] = new Set(substate[i]);
      newsubstate[i].delete(digit);
    }
  }
  return newsubstate;
}

export function addCorner(state, squares, digit) {
  const newstate = { ...state };
  newstate.corners = addHint(state.corners, squares, digit);
  return newstate;
}

export function removeCorner(state, squares, digit) {
  const newstate = { ...state };
  newstate.corners = removeHint(state.corners, squares, digit);
  return newstate;
}

export function addCenter(state, squares, digit) {
  const newstate = { ...state };
  newstate.centers = addHint(state.centers, squares, digit);
  return newstate;
}

export function removeCenter(state, squares, digit) {
  const newstate = { ...state };
  newstate.centers = removeHint(state.centers, squares, digit);
  return newstate;
}
