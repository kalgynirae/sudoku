import * as Immutable from "immutable";

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
  Center = "center",
  Corner = "corner",
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
type ApplyDiffRequestMessage = {
  type: "applyDiff";
  syncId: number;
  diff: BoardDiff;
};
type RequestMessage = SetBoardStateRequestMessage | ApplyDiffRequestMessage;

type InitResponseMessage = {
  type: "init";
  boardId: string;
  boardState: ServerBoardState;
};
type PartialUpdateResponseMessage = {
  type: "partialUpdate";
  syncId: number;
  diff: BoardDiff;
};
type ResponseMessage = InitResponseMessage | PartialUpdateResponseMessage;

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
  switch (operation.fn) {
    case "setNumber":
      return square.set("number", operation.digit);
    // TODO: Implement other operations
    default:
      throw new Error(
        `Tried to applyDiff of invalid operation type: ${operation.fn}`
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

  applyDiff(diff: BoardDiff): LocalBoardState {
    return this.createMemo(
      diff.squares.reduce(
        (boardSquares, diffSquareIdx) =>
          boardSquares.update(diffSquareIdx, (boardSquare) =>
            applyDiffOperationToSquare(boardSquare, diff.operation)
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

  // the listener will be called whenever the board state updates
  addBoardStateListener(listener: (boardState: LocalBoardState) => void) {
    this.boardStateListeners.push(listener);
  }

  removeBoardStateListener(listener: (boardState: LocalBoardState) => void) {
    this.boardStateListeners = this.boardStateListeners.filter(
      (l) => l !== listener
    );
  }

  abstract applyDiff(diff: BoardDiff): void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class LocalGameState extends BaseGameState {
  private boardStateStack: LocalBoardState[] = [];

  applyDiff(diff: BoardDiff): void {
    const prevBoardState = this.boardStateStack[
      this.boardStateStack.length - 1
    ];
    const newBoardState = prevBoardState.applyDiff(diff);
    if (newBoardState !== prevBoardState) {
      this.boardStateStack.push(newBoardState);
      this.triggerBoardStateUpdate(newBoardState);
    }
  }
}

class RemoteGameState extends BaseGameState {
  // what the server has confirmed
  private serverBoardState: LocalBoardState | null = null;
  // what the UI should currently show
  private clientBoardState: LocalBoardState = LocalBoardState.empty();
  // the diffs that make up the difference between the server's board state and
  // the client's
  private unconfirmedDiffs: BoardDiff[] = [];
  // sync IDs are used to figure out what diffs we can remove from the
  // unconfirmedDiffs queue
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
        this.serverBoardState = this.serverBoardState.applyDiff(msg.diff);

        // use syncId to update unconfirmedDiffs
        if (msg.syncId > this.lastReceivedSyncId) {
          this.unconfirmedDiffs.splice(0, msg.syncId - this.lastReceivedSyncId);
        }
        this.lastReceivedSyncId = msg.syncId;

        // apply unconfirmedDiffs to serverBoardState to get the new clientBoardState
        const newClientBoardState = this.unconfirmedDiffs.reduce(
          (st, df) => st.applyDiff(df),
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

  applyDiff(diff: BoardDiff): void {
    const newClientBoardState = this.clientBoardState.applyDiff(diff);
    this.unconfirmedDiffs.push(diff);
    this.sendRequestMessage({
      type: "applyDiff",
      syncId: ++this.lastSentSyncId,
      diff,
    });
    if (newClientBoardState !== this.clientBoardState) {
      this.clientBoardState = newClientBoardState;
      this.triggerBoardStateUpdate(newClientBoardState);
    }
  }
}

// @ts-ignore: stick this on window for testing
window.RemoteGameState = RemoteGameState;
// @ts-ignore
window.getTestRemoteGameState = async () => {
  const gs = new RemoteGameState(
    new WebSocket("ws://127.0.0.1:9091/api/v1/realtime/")
  );
  await gs.connect();
  gs.addBoardStateListener((bs) => console.log(bs.squares.toJS()));
  return gs;
};
