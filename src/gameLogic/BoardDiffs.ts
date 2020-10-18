/**
 * "Low-level" operations that change a board's state. These diffs are sent to
 * the server in groups, so they must match between the server and client.
 *
 * The goal is that some features can be added to the client without making
 * changes to the server by changing the set of diffs we send to the server.
 */

import * as Immutable from "immutable";

import LocalBoardState, { BoardSquare as LocalBoardSquare } from "./BoardState";

type ValueOf<T> = T[keyof T];
export enum BoardPencilType {
  Centers = "centers",
  Corners = "corners",
}

export type SetNumberOperation = {
  fn: "setNumber";
  digit: number | null;
};
export type AddPencilMarkOperation = {
  fn: "addPencilMark";
  type: ValueOf<typeof BoardPencilType>;
  digit: number;
};
export type RemovePencilMarkOperation = {
  fn: "removePencilMark";
  type: ValueOf<typeof BoardPencilType>;
  digit: number;
};
export type ClearPencilMarksOperation = {
  fn: "clearPencilMarks";
  type: ValueOf<typeof BoardPencilType>;
};
export type BoardDiffOperation =
  | SetNumberOperation
  | AddPencilMarkOperation
  | RemovePencilMarkOperation
  | ClearPencilMarksOperation;

export type BoardDiff = {
  squares: number[];
  operation: BoardDiffOperation;
};

function applyDiffOperationToSquare(
  square: LocalBoardSquare,
  operation: BoardDiffOperation
): LocalBoardSquare {
  if (square.get("locked")) {
    return square;
  }
  switch (operation.fn) {
    case "setNumber":
      return square.set("number", operation.digit);
    case "addPencilMark":
      return square.update(operation.type, (pm) => pm.add(operation.digit));
    case "removePencilMark":
      return square.update(operation.type, (pm) => pm.delete(operation.digit));
    case "clearPencilMarks":
      return square.set(operation.type, Immutable.Set());
    default:
      throw new Error(
        `Tried call applyDiffs with invalid operation: ${operation}`
      );
  }
}

function createBoardStateMemo(
  state: LocalBoardState,
  squares: Immutable.List<LocalBoardSquare>
): LocalBoardState {
  return state.squares === squares ? state : new LocalBoardState(squares);
}

export function applyDiffsToLocalBoardState(
  state: LocalBoardState,
  diffs: BoardDiff[]
): LocalBoardState {
  return createBoardStateMemo(
    state,
    diffs.reduce(
      (squares, d) =>
        d.squares.reduce(
          (boardSquares, diffSquareIdx) =>
            boardSquares.update(diffSquareIdx, (boardSquare) =>
              applyDiffOperationToSquare(boardSquare, d.operation)
            ),
          squares
        ),
      state.squares
    )
  );
}
