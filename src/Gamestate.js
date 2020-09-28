import { List, Map, Set, Repeat, is } from "immutable";

const INITIAL_BOARD = List(
  Repeat(Map({ number: null, corners: Set(), centers: Set() }), 81)
);

export function anyContains(board, squares, type, digit) {
  return squares
    .map((i) => board.get(i))
    .some((square) => square.hasIn([type, digit]));
}

export function setNumber(board, squares, digit) {
  return squares.reduce(
    (board, square) => board.setIn([square, "number"], digit),
    board
  );
}

export function addPencilMark(board, squares, type, digit) {
  return squares.reduce(
    (board, square) =>
      board.updateIn([square, type], (marks) => marks.add(digit)),
    board
  );
}

export function clearPencilMarks(board, squares, type) {
  return squares.reduce(
    (board, square) => board.setIn([square, type], Set()),
    board
  );
}

export function removePencilMark(board, squares, type, digit) {
  return squares.reduce(
    (board, square) =>
      board.updateIn([square, type], (marks) => marks.remove(digit)),
    board
  );
}

export const INITIAL_GAMESTATE = Map({
  boards: List.of(INITIAL_BOARD),
  index: 0,
});

export function updateBoard(gamestate, updater) {
  const currentBoard = gamestate.getIn(["boards", gamestate.get("index")]);
  const newBoard = updater(currentBoard);
  if (is(newBoard, currentBoard)) {
    return gamestate;
  }
  return gamestate.merge({
    boards: gamestate
      .get("boards")
      .slice(0, gamestate.get("index") + 1)
      .push(newBoard),
    index: gamestate.get("index") + 1,
  });
}

function undo(gamestate) {
  return canUndo(gamestate)
    ? gamestate.update("index", (i) => i - 1)
    : gamestate;
}

function redo(gamestate) {
  return canRedo(gamestate)
    ? gamestate.update("index", (i) => i + 1)
    : gamestate;
}

export function canUndo(gamestate) {
  return gamestate.get("index") > 0;
}

export function canRedo(gamestate) {
  return gamestate.get("index") < gamestate.get("boards").size - 1;
}

export const Modes = {
  normal: "normal",
  corners: "corners",
  centers: "centers",
};

export const Action = {
  input: "input",
  undo: "undo",
  redo: "redo",
};

export function updateGamestate(gamestate, action) {
  switch (action.type) {
    case Action.input:
      return updateBoard(gamestate, (board) => {
        if (
          (action.mode === Modes.normal && action.squares.length === 1) ||
          (action.mode === Modes.normal && action.digit === null)
        ) {
          return setNumber(board, action.squares, action.digit);
        } else if (
          action.mode === Modes.normal ||
          action.mode === Modes.corners ||
          action.mode === Modes.centers
        ) {
          const effectiveMode =
            action.mode === Modes.normal ? Modes.corners : action.mode;
          if (action.digit === null) {
            return clearPencilMarks(board, action.squares, effectiveMode);
          } else if (
            anyContains(board, action.squares, effectiveMode, action.digit)
          ) {
            return removePencilMark(
              board,
              action.squares,
              effectiveMode,
              action.digit
            );
          } else {
            return addPencilMark(
              board,
              action.squares,
              effectiveMode,
              action.digit
            );
          }
        } else {
          throw new Error(`Invalid action.mode: ${action.mode}`);
        }
      });
    case Action.undo:
      return undo(gamestate);
    case Action.redo:
      return redo(gamestate);
    default:
      throw new Error(`Invalid action.type: ${action.type}`);
  }
}
