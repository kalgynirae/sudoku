import * as immutable from "immutable";

import { affectedBy, box, col, row } from "./Geometry.js";

// TOOD: this is dead code, we just want to load it into the page
import "./gameLogic/LocalGameState.ts";
import "./gameLogic/RemoteGameState.ts";

const Square = immutable.Record({
  number: null,
  corners: immutable.Set(),
  centers: immutable.Set(),
  locked: false,
});

export function createBoard(numbers) {
  numbers = numbers ?? immutable.Repeat(null, 81);
  if (numbers.size !== 81) {
    throw new Error(`numbers had length ${numbers.length}; expected 81`);
  }
  return numbers
    .map((number) =>
      Square({
        number: number,
        corners: immutable.Set(),
        centers: immutable.Set(),
        locked: number !== null,
      })
    )
    .toList();
}

export function anyContains(board, squares, type, digit) {
  return squares
    .map((i) => board.get(i))
    .some((square) => square.hasIn([type, digit]));
}

export function setNumber(settings, board, square, digit) {
  if (board.getIn([square, "locked"])) {
    return board;
  }
  const affectedSquares = affectedBy(square);
  return board.withMutations((board) => {
    board.setIn([square, "number"], digit);
    clearPencilMarks(board, immutable.List.of(square), "corners");
    clearPencilMarks(board, immutable.List.of(square), "centers");
    if (settings.get("automaticallyRemoveMarks")) {
      removePencilMark(board, affectedSquares, "corners", digit);
      removePencilMark(board, affectedSquares, "centers", digit);
    }
  });
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
    (board, square) => board.setIn([square, type], immutable.Set()),
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

const Gamestate = immutable.Record({
  boards: immutable.List.of(createBoard(null)),
  index: 0,
});

export function createGamestate(initial_board) {
  return Gamestate({ boards: immutable.List.of(initial_board) });
}

export function updateBoard(gamestate, updater) {
  const currentBoard = gamestate.boards.get(gamestate.index);
  const newBoard = updater(currentBoard);
  if (immutable.is(newBoard, currentBoard)) {
    return gamestate;
  }
  return gamestate.merge({
    boards: gamestate.boards.slice(0, gamestate.index + 1).push(newBoard),
    index: gamestate.index + 1,
  });
}

function undo(gamestate, settings) {
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
  return gamestate.index > 0;
}

export function canRedo(gamestate) {
  return gamestate.index < gamestate.boards.size - 1;
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
  clearSelection: "clearSelection",
  selectSquares: "selectSquares",
  deselectSquares: "deselectSquares",
  selectDirection: "selectDirection",
};

export function updateGamestate(
  gamestate,
  { mode, selection, settings, action, squares, digit, direction }
) {
  switch (action) {
    case Action.input:
      return updateBoard(gamestate, (board) => {
        if (
          (mode === Modes.normal && selection.squares.size === 1) ||
          (mode === Modes.normal && digit === null)
        ) {
          return setNumber(settings, board, selection.squares.first(), digit);
        } else if (
          mode === Modes.normal ||
          mode === Modes.corners ||
          mode === Modes.centers
        ) {
          const incompleteSquares = selection.squares.filter(
            (s) => board.get(s).number === null
          );
          const effectiveMode = mode === Modes.normal ? Modes.corners : mode;
          if (digit === null) {
            return clearPencilMarks(board, incompleteSquares, effectiveMode);
          } else if (
            anyContains(board, incompleteSquares, effectiveMode, digit)
          ) {
            return removePencilMark(
              board,
              incompleteSquares,
              effectiveMode,
              digit
            );
          } else {
            return addPencilMark(
              board,
              incompleteSquares,
              effectiveMode,
              digit
            );
          }
        } else {
          throw new Error(`Invalid mode: ${mode}`);
        }
      });
    case Action.undo:
      return undo(gamestate, settings);
    case Action.redo:
      return redo(gamestate);
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}

export function getErrors(board) {
  const rows = immutable.Range(0, 9).map((r) => row(r));
  const columns = immutable.Range(0, 9).map((c) => col(c));
  const boxes = immutable.Range(0, 9).map((b) => box(b));
  const sections = rows.concat(columns, boxes);
  const errorSquares = immutable.Set().asMutable();
  sections.forEach((section) => {
    const squareNumbers = immutable
      .Map(section.map((s) => [s, board.get(s).number]))
      .filter((v) => v !== null);
    const numberCounts = squareNumbers.countBy((number) => number);
    squareNumbers.forEach((number, s) => {
      if (numberCounts.get(number) > 1) {
        errorSquares.add(s);
      }
    });
  });
  return errorSquares.asImmutable();
}

export function squareIncludesDigit(square, digit) {
  return digit === null
    ? false
    : square.number === digit ||
        square.corners.includes(digit) ||
        square.centers.includes(digit);
}
