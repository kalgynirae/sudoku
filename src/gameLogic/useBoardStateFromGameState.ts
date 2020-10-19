import { useEffect, useState } from "react";

import BaseGameState from "./BaseGameState";
import BoardState from "./BoardState";

export default function useBoardStateFromGameState(
  gameState: BaseGameState
): BoardState {
  const [boardState, setBoardState] = useState(gameState.getBoardState());
  useEffect(() => {
    gameState.addBoardStateListener(setBoardState);
    return () => {
      gameState.removeBoardStateListener(setBoardState);
    };
  }, [gameState, setBoardState]);
  return boardState;
}
