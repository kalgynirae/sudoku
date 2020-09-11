export const EMPTY_GAME_STATE = {
  numbers: new Array(81).fill(null),
  corners: new Array(81).fill(new Set()),
  centers: new Array(81).fill(new Set()),
};
export const EMPTY_SET = new Set();

export function anyContains(substate, selection, digit) {
  for (let i of selection) {
    if (substate[i].has(digit)) return true;
  }
  return false;
}

export function setNumber(state, selection, digit) {
  const newstate = { ...state };
  newstate.numbers = [...state.numbers];
  for (let i of selection) {
    newstate.numbers[i] = digit;
  }
  return newstate;
}

export function addHint(substate, selection, digit) {
  const newsubstate = [...substate];
  for (let i of selection) {
    if (!substate[i].has(digit)) {
      newsubstate[i] = new Set(substate[i]);
      newsubstate[i].add(digit);
    }
  }
  return newsubstate;
}

export function removeHint(substate, selection, digit) {
  const newsubstate = [...substate];
  for (let i of selection) {
    if (substate[i].has(digit)) {
      newsubstate[i] = new Set(substate[i]);
      newsubstate[i].delete(digit);
    }
  }
  return newsubstate;
}

export function addCorner(state, selection, digit) {
  const newstate = { ...state };
  newstate.corners = addHint(state.corners, selection, digit);
  return newstate;
}

export function removeCorner(state, selection, digit) {
  const newstate = { ...state };
  newstate.corners = removeHint(state.corners, selection, digit);
  return newstate;
}

export function addCenter(state, selection, digit) {
  const newstate = { ...state };
  newstate.centers = addHint(state.centers, selection, digit);
  return newstate;
}

export function removeCenter(state, selection, digit) {
  const newstate = { ...state };
  newstate.centers = removeHint(state.centers, selection, digit);
  return newstate;
}
