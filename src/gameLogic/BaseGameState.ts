import { affectedBy } from "../Geometry.js";
import { BoardDiff, BoardPencilType } from "./BoardDiffs";
import BoardState from "./BoardState";

function nullthrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("unexpected null value");
  }
  return value;
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

  setNumber(
    squareIdx: number,
    digit: number | null,
    options?: { automaticallyRemoveMarks?: boolean }
  ): void {
    options = { automaticallyRemoveMarks: false, ...(options ?? {}) };
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
