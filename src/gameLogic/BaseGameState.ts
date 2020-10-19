import * as Immutable from "immutable";

import { affectedBy } from "../Geometry.js";
import { BoardDiff, BoardPencilType } from "./BoardDiffs";
import BoardState from "./BoardState";

// TODO: this should be a typescript enum
export const Modes: { [key: string]: string } = {
  normal: "normal",
  corners: "corners",
  centers: "centers",
};

function nullthrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("unexpected null value");
  }
  return value;
}

function anyContains(
  board: BoardState,
  squareIdxSet: Immutable.Set<number>,
  type: BoardPencilType,
  digit: number
): boolean {
  return squareIdxSet
    .map((i) => nullthrows(board.squares.get(i)))
    .some((square) => square.hasIn([type, digit]));
}

export default abstract class BaseGameState {
  private boardStateListeners: ((boardState: BoardState) => void)[] = [];

  protected triggerBoardStateUpdate(boardState: BoardState) {
    for (const listener of this.boardStateListeners) {
      listener(boardState);
    }
  }

  canUndo(): boolean {
    return false;
  }

  canRedo(): boolean {
    return false;
  }

  undo(): void {
    throw Error("if canUndo is overridden, then undo should be overridden too");
  }

  redo(): void {
    throw Error("if canRedo is overridden, then redo should be overridden too");
  }

  // the listener will be called whenever the board state updates
  addBoardStateListener(listener: (boardState: BoardState) => void) {
    this.boardStateListeners.push(listener);
  }

  removeBoardStateListener(listener: (boardState: BoardState) => void) {
    this.boardStateListeners = this.boardStateListeners.filter(
      (l) => l !== listener
    );
  }

  abstract applyDiffs(diffs: BoardDiff[]): void;
  abstract getBoardState(): BoardState;

  /**
   * Applies the user's input to the board by combining the input with the
   * current board state.
   *
   * For example, setting a pencil mark is actually behaves like a toggle.
   */
  applyInput(
    selection: any,
    mode: string,
    digit: any,
    options?: { automaticallyRemoveMarks?: boolean }
  ) {
    // It's correct to read the board state here, because this function's goal
    // is to determine which action the user intended based on what they saw on
    // the board. Retroactively changing that later when reapplying diffs would
    // change the action to something the user didn't intend, which would be
    // wrong.
    const boardState = this.getBoardState();
    if (
      (mode === Modes.normal && selection.squares.size === 1) ||
      (mode === Modes.normal && digit === null)
    ) {
      this.setNumber(selection.squares.first(), digit, options);
    } else if (
      mode === Modes.normal ||
      mode === Modes.corners ||
      mode === Modes.centers
    ) {
      const incompleteSquares = selection.squares.filter(
        (s: number) =>
          nullthrows(boardState.squares.get(s)).get("number") === null
      );
      const pencilType = {
        [Modes.normal]: BoardPencilType.Corners,
        [Modes.corners]: BoardPencilType.Corners,
        [Modes.centers]: BoardPencilType.Centers,
      }[mode];
      if (digit === null) {
        this.clearPencilMarks(incompleteSquares, pencilType);
      } else if (
        anyContains(boardState, incompleteSquares, pencilType, digit)
      ) {
        this.removePencilMark(incompleteSquares.toJS(), pencilType, digit);
      } else {
        this.addPencilMark(incompleteSquares.toJS(), pencilType, digit);
      }
    } else {
      throw new Error(`Invalid mode: ${mode}`);
    }
  }

  setNumber(
    squareIdx: number,
    digit: number | null,
    options?: { automaticallyRemoveMarks?: boolean }
  ): void {
    options = { automaticallyRemoveMarks: false, ...(options ?? {}) };
    console.log("options", options);
    // HACK: We shouldn't read the board state here. There's no risk of this
    // behavior causing a desync, but this could still result in unexpected
    // results.
    if (nullthrows(this.getBoardState().squares.get(squareIdx)).get("locked")) {
      return;
    }
    let diffs: BoardDiff[] = [
      { squares: [squareIdx], operation: { fn: "setNumber", digit: digit } },
    ];
    if (digit != null) {
      diffs.push(
        {
          squares: [squareIdx],
          operation: { fn: "clearPencilMarks", type: BoardPencilType.Centers },
        },
        {
          squares: [squareIdx],
          operation: { fn: "clearPencilMarks", type: BoardPencilType.Corners },
        }
      );
      if (options.automaticallyRemoveMarks) {
        const affectedSquares = affectedBy(squareIdx).toJS();
        diffs.push(
          {
            squares: affectedSquares,
            operation: {
              fn: "removePencilMark",
              type: BoardPencilType.Centers,
              digit,
            },
          },
          {
            squares: affectedSquares,
            operation: {
              fn: "removePencilMark",
              type: BoardPencilType.Corners,
              digit,
            },
          }
        );
      }
    }
    this.applyDiffs(diffs);
  }

  addPencilMark(squareIdxList: number[], type: BoardPencilType, digit: number) {
    this.applyDiffs([
      {
        squares: squareIdxList,
        operation: { fn: "addPencilMark", type, digit },
      },
    ]);
  }

  removePencilMark(
    squareIdxList: number[],
    type: BoardPencilType,
    digit: number
  ) {
    this.applyDiffs([
      {
        squares: squareIdxList,
        operation: { fn: "removePencilMark", type, digit },
      },
    ]);
  }

  clearPencilMarks(squareIdxList: number[], type: BoardPencilType) {
    this.applyDiffs([
      { squares: squareIdxList, operation: { fn: "clearPencilMarks", type } },
    ]);
  }
}
