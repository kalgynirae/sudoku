import BaseGameState from "./BaseGameState";
import { applyDiffsToLocalBoardState, BoardDiff } from "./BoardDiffs";
import BoardState from "./BoardState";

export default class LocalGameState extends BaseGameState {
  private boardStateStack: BoardState[];
  private boardStatePosition: number = 0;

  constructor(startingBoardState: BoardState) {
    super();
    this.boardStateStack = [startingBoardState];
  }

  canUndo(): boolean {
    return this.boardStatePosition > 0;
  }

  canRedo(): boolean {
    return this.boardStatePosition < this.boardStateStack.length - 1;
  }

  undo() {
    this.boardStatePosition--;
    this.triggerBoardStateUpdate(this.boardStateStack[this.boardStatePosition]);
  }

  redo() {
    this.boardStatePosition++;
    this.triggerBoardStateUpdate(this.boardStateStack[this.boardStatePosition]);
  }

  applyDiffs(diffs: BoardDiff[]): void {
    const prevBoardState = this.getBoardState();
    const newBoardState = applyDiffsToLocalBoardState(prevBoardState, diffs);
    if (newBoardState !== prevBoardState) {
      // discard any redos in the stack
      this.boardStateStack.splice(this.boardStatePosition + 1);
      // and push this new state onto the undo stack
      this.boardStateStack.push(newBoardState);
      this.boardStatePosition++;
      this.triggerBoardStateUpdate(newBoardState);
    }
  }

  getBoardState(): BoardState {
    return this.boardStateStack[this.boardStatePosition];
  }
}

// @ts-ignore: stick this on window for testing
window.getTestLocalGameState = () => {
  const gs = new LocalGameState(BoardState.empty());
  gs.addBoardStateListener((bs) => console.log(bs.squares.toJS()));
  return gs;
};
