import { is, List, Map, Range, Repeat, Set } from "immutable";

import { affectedBy, box, col, row } from "./Geometry.js";
// TOOD: this is dead code, we just want to load it into the page
// eslint-disable-next-line no-unused-vars
import { RealtimeGamestate } from "./Realtime.ts";

export function createBoard(numbers) {
  numbers = numbers ?? Repeat(null, 81);
  if (numbers.size !== 81) {
    throw new Error(`numbers had length ${numbers.length}; expected 81`);
  }
  return numbers
    .map((number) =>
      Map({
        number: number,
        corners: Set(),
        centers: Set(),
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
    clearPencilMarks(board, List.of(square), "corners");
    clearPencilMarks(board, List.of(square), "centers");
    if (settings.get("automaticallyRemoveHints")) {
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

export function createGamestate(initial_board) {
  return Map({
    boards: List.of(initial_board),
    index: 0,
  });
}

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

export function updateGamestate(
  gamestate,
  { action, mode, squares, digit, settings }
) {
  switch (action) {
    case Action.input:
      return updateBoard(gamestate, (board) => {
        if (
          (mode === Modes.normal && squares.length === 1) ||
          (mode === Modes.normal && digit === null)
        ) {
          return setNumber(settings, board, squares[0], digit);
        } else if (
          mode === Modes.normal ||
          mode === Modes.corners ||
          mode === Modes.centers
        ) {
          const incompleteSquares = squares.filter(
            (s) => board.get(s).get("number") === null
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
      return undo(gamestate);
    case Action.redo:
      return redo(gamestate);
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}

export function getErrors(board) {
  const rows = Range(0, 9).map((r) => row(r));
  const columns = Range(0, 9).map((c) => col(c));
  const boxes = Range(0, 9).map((b) => box(b));
  const sections = rows.concat(columns, boxes);
  const errorSquares = Set().asMutable();
  sections.forEach((section) => {
    const squareNumbers = Map(
      section.map((s) => [s, board.getIn([s, "number"])])
    ).filter((v) => v !== null);
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
    : square.get("number") === digit ||
        square.get("corners").includes(digit) ||
        square.get("centers").includes(digit);
}
