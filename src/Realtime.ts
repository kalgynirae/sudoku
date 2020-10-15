import * as Immutable from "immutable";

import { affectedBy } from "./Geometry.js";

type ServerBoardSquare = {
  number: number | null;
  corners: number[];
  centers: number[];
  locked: boolean;
};

type ServerBoardState = {
  squares: ServerBoardSquare[];
};

type ValueOf<T> = T[keyof T];
enum BoardPencilType {
  Centers = "centers",
  Corners = "corners",
}

type SetNumberOperation = {
  fn: "setNumber";
  digit: number | null;
};
type AddPencilMarkOperation = {
  fn: "addPencilMark";
  type: ValueOf<typeof BoardPencilType>;
  digit: number;
};
type RemovePencilMarkOperation = {
  fn: "removePencilMark";
  type: ValueOf<typeof BoardPencilType>;
  digit: number;
};
type ClearPencilMarksOperation = {
  fn: "clearPencilMarks";
  type: ValueOf<typeof BoardPencilType>;
};
type BoardDiffOperation =
  | SetNumberOperation
  | AddPencilMarkOperation
  | RemovePencilMarkOperation
  | ClearPencilMarksOperation;

type BoardDiff = {
  squares: number[];
  operation: BoardDiffOperation;
};

type SetBoardStateRequestMessage = {
  type: "setBoardState";
  boardState: ServerBoardState;
};
type ApplyDiffsRequestMessage = {
  type: "applyDiffs";
  syncId: number;
  diffs: BoardDiff[];
};
type RequestMessage = SetBoardStateRequestMessage | ApplyDiffsRequestMessage;

type InitResponseMessage = {
  type: "init";
  boardId: string;
  boardState: ServerBoardState;
};
type PartialUpdateResponseMessage = {
  type: "partialUpdate";
  syncId: number;
  diffs: BoardDiff[];
};
type ResponseMessage = InitResponseMessage | PartialUpdateResponseMessage;

function nullthrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("unexpected null value");
  }
  return value;
}

export class RealtimeApi {
  private responseMessageListeners: ((message: ResponseMessage) => void)[];

  constructor(private ws: WebSocket) {
    this.responseMessageListeners = [];
    ws.onmessage = this.onMessage;
  }

  static init(url: string): Promise<RealtimeApi> {
    const ws = new WebSocket(url);
    const rt = new RealtimeApi(ws);
    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(rt);
      ws.onerror = reject;
    });
  }

  private onMessage = (rawMessage: MessageEvent) => {
    let message = JSON.parse(rawMessage.data);
    for (const listener of this.responseMessageListeners) {
      listener(message);
    }
  };

  addResponseMessageListener(listener: (message: ResponseMessage) => void) {
    this.responseMessageListeners.push(listener);
  }

  removeResponseMessageListener(listener: (message: ResponseMessage) => void) {
    this.responseMessageListeners = this.responseMessageListeners.filter(
      (l) => l !== listener
    );
  }
}

// same as ServerBoardSquare, but with Immutable
type LocalBoardSquareProps = {
  number: number | null;
  corners: Immutable.Set<number>;
  centers: Immutable.Set<number>;
  locked: boolean;
};

const localBoardSquareDefaultValues: LocalBoardSquareProps = {
  number: null,
  corners: Immutable.Set(),
  centers: Immutable.Set(),
  locked: false,
};

const createLocalBoardSquare: Immutable.Record.Factory<LocalBoardSquareProps> = Immutable.Record(
  localBoardSquareDefaultValues
);

type LocalBoardSquare = Immutable.Record<LocalBoardSquareProps>;

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

class LocalBoardState {
  constructor(public readonly squares: Immutable.List<LocalBoardSquare>) {}

  static empty() {
    return LocalBoardState.withNumbers(Immutable.Repeat(null, 81));
  }

  static withNumbers(numbers: Iterable<number | null>) {
    return new LocalBoardState(
      Immutable.Seq(numbers)
        .map((number) =>
          createLocalBoardSquare({
            number: number,
            locked: number !== null,
          })
        )
        .toList()
    );
  }

  private createMemo(
    squares: Immutable.List<LocalBoardSquare>
  ): LocalBoardState {
    return this.squares === squares ? this : new LocalBoardState(squares);
  }

  applyDiffs(diffs: BoardDiff[]): LocalBoardState {
    return this.createMemo(
      diffs.reduce(
        (squares, d) =>
          d.squares.reduce(
            (boardSquares, diffSquareIdx) =>
              boardSquares.update(diffSquareIdx, (boardSquare) =>
                applyDiffOperationToSquare(boardSquare, d.operation)
              ),
            squares
          ),
        this.squares
      )
    );
  }
}

abstract class BaseGameState {
  private boardStateListeners: ((boardState: LocalBoardState) => void)[] = [];

  protected triggerBoardStateUpdate(boardState: LocalBoardState) {
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
  addBoardStateListener(listener: (boardState: LocalBoardState) => void) {
    this.boardStateListeners.push(listener);
  }

  removeBoardStateListener(listener: (boardState: LocalBoardState) => void) {
    this.boardStateListeners = this.boardStateListeners.filter(
      (l) => l !== listener
    );
  }

  abstract applyDiffs(diffs: BoardDiff[]): void;
  abstract getBoardState(): LocalBoardState;

  // high level APIs:
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class LocalGameState extends BaseGameState {
  private boardStateStack: LocalBoardState[];
  private boardStatePosition: number = 0;

  constructor(startingBoardState: LocalBoardState) {
    super();
    this.boardStateStack = [startingBoardState];
  }

  canUndo(): boolean {
    return this.boardStatePosition > 0;
  }

  canRedo(): boolean {
    return this.boardStatePosition < this.boardStateStack.length;
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
    const newBoardState = prevBoardState.applyDiffs(diffs);
    if (newBoardState !== prevBoardState) {
      // discard any redos in the stack
      this.boardStateStack.splice(this.boardStatePosition + 1);
      // and push this new state onto the undo stack
      this.boardStateStack.push(newBoardState);
      this.boardStatePosition++;
      this.triggerBoardStateUpdate(newBoardState);
    }
  }

  getBoardState(): LocalBoardState {
    return this.boardStateStack[this.boardStatePosition];
  }
}

class RemoteGameState extends BaseGameState {
  // what the server has confirmed
  private serverBoardState: LocalBoardState | null = null;
  // what the UI should currently show
  private clientBoardState: LocalBoardState = LocalBoardState.empty();
  // the diffs that make up the difference between the server's board state and
  // the client's
  private unconfirmedDiffGroups: BoardDiff[][] = [];
  // sync IDs are used to figure out what diffs we can remove from the
  // unconfirmedDiffGroups queue
  private lastSentSyncId: number = 0;
  private lastReceivedSyncId: number = 0;

  constructor(private ws: WebSocket) {
    super();
  }

  connect(): Promise<void> {
    this.ws.onmessage = this.onMessage;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
  }

  close(): void {
    this.ws.close();
  }

  private onMessage = (rawMessage: MessageEvent) => {
    this.onResponseMessage(JSON.parse(rawMessage.data));
  };

  private sendRequestMessage(msg: RequestMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  private onResponseMessage(msg: ResponseMessage): void {
    switch (msg.type) {
      case "init":
        // TODO: implement me
        this.serverBoardState = LocalBoardState.empty();
        break;
      case "partialUpdate":
        if (this.serverBoardState == null) {
          throw new Error("got partialUpdate before init");
        }
        this.serverBoardState = this.serverBoardState.applyDiffs(msg.diffs);

        // use syncId to update unconfirmedDiffGroups
        if (msg.syncId > this.lastReceivedSyncId) {
          this.unconfirmedDiffGroups.splice(
            0,
            msg.syncId - this.lastReceivedSyncId
          );
        }
        this.lastReceivedSyncId = msg.syncId;

        // apply unconfirmedDiffGroups to serverBoardState to get the new
        // clientBoardState
        const newClientBoardState = this.unconfirmedDiffGroups.reduce(
          (st, dfGrp) => st.applyDiffs(dfGrp),
          this.serverBoardState
        );
        // this will often differ by identity, but we should only trigger an
        // update when it differs by equality
        if (
          !newClientBoardState.squares.equals(this.clientBoardState.squares)
        ) {
          this.clientBoardState = newClientBoardState;
          this.triggerBoardStateUpdate(newClientBoardState);
        }
        break;
      default:
        throw new Error(
          `Received unsupported response message type from server: ${msg}`
        );
    }
  }

  applyDiffs(diffs: BoardDiff[]): void {
    const newClientBoardState = this.clientBoardState.applyDiffs(diffs);
    this.unconfirmedDiffGroups.push(diffs);
    this.sendRequestMessage({
      type: "applyDiffs",
      syncId: ++this.lastSentSyncId,
      diffs,
    });
    if (newClientBoardState !== this.clientBoardState) {
      this.clientBoardState = newClientBoardState;
      this.triggerBoardStateUpdate(newClientBoardState);
    }
  }

  getBoardState(): LocalBoardState {
    return this.clientBoardState;
  }
}

// @ts-ignore: stick this on window for testing
window.getTestRemoteGameState = async () => {
  const gs = new RemoteGameState(
    new WebSocket("ws://127.0.0.1:9091/api/v1/realtime/")
  );
  await gs.connect();
  gs.addBoardStateListener((bs) => console.log(bs.squares.toJS()));
  return gs;
};
// @ts-ignore
window.getTestLocalGameState = () => {
  const gs = new LocalGameState(LocalBoardState.empty());
  gs.addBoardStateListener((bs) => console.log(bs.squares.toJS()));
  return gs;
};