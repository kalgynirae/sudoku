import { faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as immutable from "immutable";
import React from "react";
import styled from "styled-components";

import { squareIncludesDigit } from "./gameLogic/BoardState.ts";
import { affectedBy, indexbox } from "./Geometry";

export function Board({
  children,
  handleTouchMove,
  boardAreaRef,
  board,
  errors,
  selection,
  settings,
}) {
  const highlights = settings.get("highlightPeers")
    ? immutable.Set.intersect(selection.squares.map(affectedBy))
    : immutable.Set();

  const boxes = [];
  for (let ibox = 0; ibox < 9; ibox++) {
    const squares = [];
    for (let isquare = 0; isquare < 9; isquare++) {
      const i = indexbox(ibox, isquare);
      const square = board.squares.get(i);
      squares.push(
        <Square
          index={i}
          isError={errors.includes(i)}
          isFocused={squareIncludesDigit(square, selection.focusDigit)}
          isLocked={square.get("locked")}
          isPeer={highlights.includes(i)}
          isSelected={selection.squares.includes(i)}
          hasCursor={selection.usingCursor && selection.cursor === i}
          number={square.get("number")}
          corners={square.get("corners")}
          centers={square.get("centers")}
          settings={settings}
        />
      );
    }
    boxes.push(<Box>{squares}</Box>);
  }

  return (
    <BoardTouchArea ref={boardAreaRef}>
      <BoardGrid onTouchMove={handleTouchMove}>{boxes}</BoardGrid>
    </BoardTouchArea>
  );
}

export const BoardSizer = styled.div`
  --box-gap: 4px;
  --square-gap: 2px;
  --square-size: 4em;
  --board-size: calc(
    9 * var(--square-size) + 6 * var(--square-gap) + 2 * var(--box-gap)
  );

  width: 100%;
  margin: 0 auto;
`;

const BoardTouchArea = styled.div`
  padding-top: 1rem;
  touch-action: none;
`;

const BoardGrid = styled.div`
  width: var(--board-size);
  height: var(--board-size);
  margin: 0 auto;

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
  isError,
  isFocused,
  isLocked,
  isPeer,
  isSelected,
  hasCursor,
  index,
  number,
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

  let lock = null;
  if (isLocked && settings.get("showLocked")) {
    lock = <Lock />;
  }

  const classes = [];
  if (isSelected) classes.push("selected");
  if (isError) classes.push("error");
  if (isFocused) classes.push("focused");
  if (isPeer) classes.push("highlighted");
  return (
    <StyledSquare className={`${classes.join(" ")}`} data-index={index}>
      {lock}
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
    box-sizing: border-box;
    position: absolute;
    height: 100%;
    width: 100%;
  }

  &.focused {
    background-color: ${(p) => p.theme.square.brighten(0.3)};
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
`;

const StyledLock = styled.div`
  color: ${(p) => p.theme.background};
  padding: 0.2em;

  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
`;
function Lock() {
  return (
    <StyledLock>
      <FontAwesomeIcon icon={faLock} />
    </StyledLock>
  );
}

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
