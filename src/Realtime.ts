interface BoardSquare {
  number: number | null;
  corners: number[];
  centers: number[];
  locked: boolean;
}

interface BoardState {
  squares: BoardSquare[];
}

interface BoardDiffOperation {
  type:
    | "SetNumber"
    | "AddCorner"
    | "RemoveCorner"
    | "AddCenter"
    | "RemoveCenter";
  digit: number;
}

interface BoardDiff {
  squares: number[];
  operation: BoardDiffOperation;
}

interface InitResponseMessage {
  type: "init";
  boardId: string;
  boardState: BoardState;
}

interface PartialUpdateResponseMessage {
  syncId: number;
  diff: BoardDiff;
}

type ResponseMessage = InitResponseMessage | PartialUpdateResponseMessage;

export class RealtimeGamestate {
  constructor(private ws: WebSocket) {
    ws.onmessage = this.onMessage;
  }

  static init(url: string): Promise<RealtimeGamestate> {
    const ws = new WebSocket(url);
    const rt = new RealtimeGamestate(ws);
    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(rt);
      ws.onerror = reject;
    });
  }

  private onMessage = (message: MessageEvent) => {
    console.log(JSON.parse(message.data));
  };

  public async applyDiff(diff: BoardDiff) {
    this.ws.send(JSON.stringify(diff));
  }
}

// @ts-ignore: stick this on window for testing
window.realtimeInit = RealtimeGamestate.init;
