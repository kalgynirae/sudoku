import React from "react";
import styled from "styled-components";
import { Set } from "immutable";

import { indexbox, affectedBy } from "./Geometry.js";

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
  touch-action: none;
`;

const BoardSizer = styled.div`
  --box-gap: 4px;
  --square-gap: 2px;
  --square-size: 4rem;

  position: relative;
  height: calc(
    9 * var(--square-size) + 6 * var(--square-gap) + 2 * var(--box-gap)
  );
  width: calc(
    9 * var(--square-size) + 6 * var(--square-gap) + 2 * var(--box-gap)
  );
  margin: 0 auto;
`;

const BoardGrid = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  column-gap: var(--box-gap);
  row-gap: var(--box-gap);

  touch-action: none;
`;

export const Box = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  column-gap: var(--square-gap);
  row-gap: var(--square-gap);

  user-select: none;
`;

const CORNER_GRID_AREA_SETS = {
  1: "a",
  2: "ac",
  3: "acg",
  4: "acgi",
  5: "abcgi",
  6: "abcghi",
  7: "abcdghi",
  8: "abcdfghi",
  9: "abcdefghi",
};

export default function Square({
  centers,
  corners,
  error,
  hasCursor,
  highlighted,
  index,
  number,
  selected,
  locked,
  settings,
}) {
  let cursor = null;
  if (hasCursor) {
    cursor = <Cursor />;
  }

  let number_or_hints = [];
  if (number !== null) {
    number_or_hints.push(<Number>{number}</Number>);
  } else {
    if (corners !== null) {
      number_or_hints.push(<Corners corners={corners} />);
    }
    if (centers !== null) {
      number_or_hints.push(<Centers centers={centers} />);
    }
  }

  const classes = [];
  if (selected) {
    classes.push("selected");
  }
  if (error) {
    classes.push("error");
  }
  if (highlighted) {
    classes.push("highlighted");
  }
  if (locked && settings.get("showLocked")) {
    classes.push("locked");
  }
  return (
    <StyledSquare className={`${classes.join(" ")}`} data-index={index}>
      {cursor}
      {number_or_hints}
    </StyledSquare>
  );
}

const StyledSquare = styled.div`
  background-color: ${(p) => p.theme.square};
  position: relative;
  transition: background-color 0.1s ease-out;
  text-align: center;

  & > * {
    position: absolute;
    height: 100%;
    width: 100%;
  }

  &.highlighted {
    background-color: ${(p) => p.theme.squareHighlighted};
    transition: none;
  }
  &.selected {
    background-color: ${(p) => p.theme.squareSelected};
    transition: none;
  }
  &.error {
    background-color: ${(p) => p.theme.squareError};
  }
  &::after {
    box-shadow: 0 0 8px ${(p) => p.theme.error};
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
    opacity: 0;
    transition: opacity 0.1s ease-out;
  }
  &.error::after {
    opacity: 1;
  }
  &.selected.error {
    background-color: ${(p) => p.theme.squareSelectedError};
  }
  &.locked {
    background-color: ${(p) => p.theme.squareLocked};
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
      transform: translateY(0.2em);
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }

  .centers,
  .corners {
  }

  .centers {
  }

  .corners {
  }
`;

const Cursor = styled.div`
  border: solid 1px ${(p) => p.theme.base.brighten(0.2)};
  box-sizing: border-box;
`;

function Number({ children }) {
  return (
    <StyledNumber>
      <span>{children}</span>
    </StyledNumber>
  );
}

const StyledNumber = styled.div`
  animation: fade-in 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: calc(var(--square-size) * 0.6);
  font-weight: 500;
`;

function Corners({ corners }) {
  const cornerNumbers = [...corners].sort();
  const cornerGridAreas = CORNER_GRID_AREA_SETS[cornerNumbers.length];
  const cornerEntries = [];
  for (let i = 0; i < cornerNumbers.length; i++) {
    cornerEntries.push({
      n: cornerNumbers[i],
      area: cornerGridAreas.charAt(i),
    });
  }
  return (
    <StyledCorners>
      {cornerEntries.map(({ n, area }) => (
        <span style={{ gridArea: area }}>{n}</span>
      ))}
    </StyledCorners>
  );
}

const StyledCorners = styled.div`
  font-family: var(--font-sans);
  font-size: 1em;
  font-weight: 500;
  align-content: space-between;
  display: grid;
  grid-template-areas: "a b c" "d e f" "g h i";
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-columns: 1fr 1fr 1fr;
  line-height: calc(var(--square-size) / 3);
`;

function Centers({ centers }) {
  return (
    <StyledCenters>
      {[...centers].sort().map((n) => (
        <span>{n}</span>
      ))}
    </StyledCenters>
  );
}

const StyledCenters = styled.div`
  font-family: var(--font-sans);
  font-size: 1em;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
`;
