import { Record } from "immutable";

import { neighbor } from "./Geometry";

export const Selection = Record;

export const SelectionActions = {
  clear: "clear",
  revert: "revert",
  selectDirection: "selectDirection",
  selectSquare: "selectSquare",
};

export const INITIAL_SELECTION = {
  squares: [],
  previousSquares: null,
  cursor: null,
  usingCursor: false,
};

export function updateSelection(selection, { action, direction, squareIndex }) {
  const newSelection = { ...selection };
  switch (action) {
    case SelectionActions.clear:
      newSelection.squares = [];
      return newSelection;
    case SelectionActions.revert:
      if (selection.previousSquares === null) return selection;
      newSelection.squares = selection.previousSquares;
      newSelection.previousSquares = null;
      return newSelection;
    case SelectionActions.selectSquare:
      if (selection.squares.includes(squareIndex)) return selection;
      newSelection.previousSquares = null;
      newSelection.squares = [...selection.squares];
      newSelection.squares.push(squareIndex);
      newSelection.cursor = squareIndex;
      newSelection.usingCursor = false;
      return newSelection;
    case SelectionActions.selectDirection:
      let i = neighbor(selection.cursor, direction) ?? selection.cursor;
      newSelection.squares = [...selection.squares, i];
      newSelection.cursor = i;
      newSelection.usingCursor = true;
      return newSelection;
    default:
  }
}
