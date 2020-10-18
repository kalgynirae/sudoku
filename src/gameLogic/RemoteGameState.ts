import LocalBoardState from "./BoardState";
import { applyDiffsToLocalBoardState, BoardDiff } from "./BoardDiffs";
import BaseGameState from "./BaseGameState";

type ServerBoardSquare = {
  number: number | null;
  corners: number[];
  centers: number[];
  locked: boolean;
};

type ServerBoardState = {
  squares: ServerBoardSquare[];
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

export default class RemoteGameState extends BaseGameState {
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
        this.serverBoardState = applyDiffsToLocalBoardState(
          this.serverBoardState,
          msg.diffs
        );

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
          (st, dfGrp) => applyDiffsToLocalBoardState(st, dfGrp),
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
    const newClientBoardState = applyDiffsToLocalBoardState(
      this.clientBoardState,
      diffs
    );
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
