import * as immutable from "immutable";

import BoardState from "./gameLogic/BoardState.ts";

export function decodeBoard(encoded) {
  const numbers = immutable.List(encoded).map((char) => {
    const parsed = parseInt(char);
    return parsed > 0 && parsed < 10 ? parsed : null;
  });
  return BoardState.withNumbers(numbers);
}

export function encodeBoard(board) {
  return board.squares.map((square) => square.get("number") ?? ".").join("");
}

export function copyBoardAsURL(board) {
  const boardstr = encodeBoard(board);
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set("board", boardstr);
  url.search = params.toString();
  navigator.clipboard.writeText(url.href);
}
