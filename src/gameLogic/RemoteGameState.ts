import * as Immutable from "immutable";

import BaseGameState from "./BaseGameState";
import { applyDiffsToLocalBoardState, BoardDiff } from "./BoardDiffs";
import LocalBoardState, {
  createBoardSquare as createLocalBoardSquare,
} from "./BoardState";

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
  roomId: string;
  boardState: ServerBoardState;
};
type PartialUpdateResponseMessage = {
  type: "partialUpdate";
  syncId: number;
  diffs: BoardDiff[];
};
type FullUpdateResponseMessage = {
  type: "fullUpdate";
  syncId: number;
  boardState: ServerBoardState;
};
type UpdateCursorResponseMessage = {
  type: "updateCursor";
  map: {[colorIdx: string]: number[]};
};
type ResponseMessage =
  | InitResponseMessage
  | PartialUpdateResponseMessage
  | FullUpdateResponseMessage
  | UpdateCursorResponseMessage;

function toLocalBoardState(serverBs: ServerBoardState): LocalBoardState {
  return new LocalBoardState(
    Immutable.Seq(serverBs.squares)
      .map((sq) =>
        createLocalBoardSquare({
          number: sq.number,
          corners: Immutable.Set(sq.corners),
          centers: Immutable.Set(sq.centers),
          locked: sq.locked,
        })
      )
      .toList()
  );
}

function toServerBoardState(localBs: LocalBoardState): ServerBoardState {
  return { squares: localBs.squares.toJS() };
}

const REALTIME_API_URI = "wss://sudoku-server.benjam.info/api/v1/realtime/";
// we want to be able to force localhost for testing
const LOCALHOST_REALTIME_API_URI = "ws://127.0.0.1:9091/api/v1/realtime/";
const FORCE_LOCALHOST = new URLSearchParams(window.location.search).has(
  "localhost"
);

function getUri(roomId?: string | null): string {
  const base = FORCE_LOCALHOST ? LOCALHOST_REALTIME_API_URI : REALTIME_API_URI;
  return roomId == null ? base : base + roomId;
}

function nullthrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("unexpected null value");
  }
  return value;
}

export default class RemoteGameState extends BaseGameState {
  private ws: WebSocket | null = null;
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
  roomId: string | null = null;

  connect(
    roomId?: string | null,
    initialBoard?: LocalBoardState | null
  ): Promise<void> {
    console.log("connect");
    const ws = new WebSocket(getUri(roomId));
    this.ws = ws;
    return new Promise((resolve, reject) => {
      ws.onmessage = (rawMsg: MessageEvent) => {
        const msg: ResponseMessage = JSON.parse(rawMsg.data);
        this.onResponseMessage(msg);
        if (msg.type === "init") {
          // TODO: This is hacky. We should revise the protocol to allow the
          // client to send an init message before the server sends its init
          // message.
          if (initialBoard) {
            this.sendRequestMessage({
              type: "setBoardState",
              boardState: toServerBoardState(initialBoard),
            });
            this.serverBoardState = initialBoard;
            this.clientBoardState = initialBoard;
            this.triggerBoardStateUpdate(initialBoard);
          }
          // only resolve after we get an init
          resolve();
        }
      };
      // TODO: add error handling for errors that happen after socket setup
      ws.onerror = (err) => reject(err);
    });
  }

  close(): void {
    this.ws?.close();
  }

  private sendRequestMessage(msg: RequestMessage) {
    // TODO: this could actually be null, handle this a bit better
    nullthrows(this.ws).send(JSON.stringify(msg));
  }

  private onResponseMessage(msg: ResponseMessage): void {
    switch (msg.type) {
      case "init":
        this.serverBoardState = toLocalBoardState(msg.boardState);
        this.clientBoardState = this.serverBoardState;
        this.unconfirmedDiffGroups = [];
        this.lastSentSyncId = 0;
        this.lastReceivedSyncId = 0;
        this.roomId = msg.roomId;
        this.triggerBoardStateUpdate(this.clientBoardState);
        break;
      case "partialUpdate":
        if (this.serverBoardState == null) {
          throw new Error("got partialUpdate before init");
        }
        this.serverBoardState = applyDiffsToLocalBoardState(
          this.serverBoardState,
          msg.diffs
        );
        this.updateClientBoardState(msg.syncId);
        break;
      case "fullUpdate":
        this.serverBoardState = toLocalBoardState(msg.boardState);
        this.clientBoardState = this.serverBoardState;
        this.updateClientBoardState(msg.syncId);
        break;
      case "updateCursor":
        console.log("updateCursor", msg);
        break;
      default:
        throw new Error(
          `Received unsupported response message type from server: ${JSON.stringify(msg)}`
        );
    }
  }

  private updateClientBoardState(syncId: number): void {
    // use syncId to update unconfirmedDiffGroups
    if (syncId > this.lastReceivedSyncId) {
      this.unconfirmedDiffGroups.splice(0, syncId - this.lastReceivedSyncId);
    }
    this.lastReceivedSyncId = syncId;

    // apply unconfirmedDiffGroups to serverBoardState to get the new
    // clientBoardState
    const newClientBoardState = this.unconfirmedDiffGroups.reduce(
      (st, dfGrp) => applyDiffsToLocalBoardState(st, dfGrp),
      nullthrows(this.serverBoardState)
    );
    // this will often differ by identity, but we should only trigger an
    // update when it differs by equality
    if (!newClientBoardState.squares.equals(this.clientBoardState.squares)) {
      this.clientBoardState = newClientBoardState;
      this.triggerBoardStateUpdate(newClientBoardState);
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
