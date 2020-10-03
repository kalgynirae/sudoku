import React from "react";
import styled from "styled-components";
import { Set } from "immutable";

import { indexbox, affectedBy } from "./Geometry.js";
import Square from "./Square.js";

export function Board({
  children,
  handleTouchMove,
  boardAreaRef,
  board,
  errors,
  selection,
  settings,
}) {
  const highlights = settings.get("highlightAffectedSquares")
    ? Set.intersect(selection.squares.map(affectedBy))
    : Set();
  return (
    <BoardArea ref={boardAreaRef}>
      <BoardSizer>
        <BoardGrid onTouchMove={handleTouchMove}>
          {renderBox(0, board, errors, selection, highlights, settings)}
          {renderBox(1, board, errors, selection, highlights, settings)}
          {renderBox(2, board, errors, selection, highlights, settings)}
          {renderBox(3, board, errors, selection, highlights, settings)}
          {renderBox(4, board, errors, selection, highlights, settings)}
          {renderBox(5, board, errors, selection, highlights, settings)}
          {renderBox(6, board, errors, selection, highlights, settings)}
          {renderBox(7, board, errors, selection, highlights, settings)}
          {renderBox(8, board, errors, selection, highlights, settings)}
        </BoardGrid>
      </BoardSizer>
    </BoardArea>
  );
}

function renderBox(i, board, errors, selection, highlights, settings) {
  return (
    <Box>
      {renderSquare(i, 0, board, errors, selection, highlights, settings)}
      {renderSquare(i, 1, board, errors, selection, highlights, settings)}
      {renderSquare(i, 2, board, errors, selection, highlights, settings)}
      {renderSquare(i, 3, board, errors, selection, highlights, settings)}
      {renderSquare(i, 4, board, errors, selection, highlights, settings)}
      {renderSquare(i, 5, board, errors, selection, highlights, settings)}
      {renderSquare(i, 6, board, errors, selection, highlights, settings)}
      {renderSquare(i, 7, board, errors, selection, highlights, settings)}
      {renderSquare(i, 8, board, errors, selection, highlights, settings)}
    </Box>
  );
}

function renderSquare(
  ibox,
  isquare,
  board,
  errors,
  selection,
  highlights,
  settings
) {
  const i = indexbox(ibox, isquare);
  const square = board.get(i);
  return (
    <Square
      index={i}
      error={errors.includes(i)}
      hasCursor={selection.usingCursor && selection.cursor === i}
      highlighted={highlights.includes(i)}
      selected={selection.squares.includes(i)}
      locked={square.get("locked")}
      number={square.get("number")}
      corners={square.get("corners")}
      centers={square.get("centers")}
      settings={settings}
    />
  );
}

const BoardArea = styled.div`
  border: 1px solid ${(p) => p.theme.border};
  touch-action: none;
`;

const BoardSizer = styled.div`
  --board-size: 36rem;
  --box-gap: 4px;
  --square-gap: 2px;
  position: relative;
  height: calc(var(--board-size) + 6 * var(--square-gap) + 2 * var(--box-gap));
  width: calc(var(--board-size) + 6 * var(--square-gap) + 2 * var(--box-gap));
  margin: 1rem auto;
`;

const BoardGrid = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  column-gap: var(--box-gap);
  row-gap: var(--box-gap);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  touch-action: none;
`;

export const Box = styled.div`
  column-gap: var(--square-gap);
  row-gap: var(--square-gap);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  user-select: none;
`;
