import * as immutable from "immutable";

import { neighbor } from "./Geometry";

export const Selection = immutable.Record({
  cursor: null,
  focusDigit: null,
  squares: immutable.Set(),
  usingCursor: false,
});

export const SelectionAction = {
  clear: "clear",
  addSquare: "addSquare",
  removeSquare: "removeSquare",
  addDirection: "addDirection",
  focus: "focus",
};

export function updateSelection(
  selection,
  { action, square, direction, digit }
) {
  switch (action) {
    case SelectionAction.clear:
      return selection.set("squares", immutable.Set());
    case SelectionAction.addSquare:
      return selection.merge({
        cursor: square,
        squares: selection.squares.add(square),
        usingCursor: false,
      });
    case SelectionAction.removeSquare:
      return selection.merge({
        cursor: square,
        squares: selection.squares.remove(square),
      });
    case SelectionAction.addDirection:
      let i = neighbor(selection.cursor, direction) ?? selection.cursor;
      return selection.merge({
        squares: selection.squares.add(i),
        cursor: i,
        usingCursor: true,
      });
    case SelectionAction.focus:
      return selection.withMutations((selection) => {
        selection.set("focusDigit", digit);
        if (digit !== null) {
          selection.set("squares", immutable.Set());
        }
      });
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}
