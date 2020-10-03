import React from "react";
import styled from "styled-components";

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

  .number {
    animation: fade-in 0.1s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 2.5em;
    font-weight: 500;
  }

  .centers,
  .corners {
    font-family: var(--font-sans);
    font-size: 1em;
    font-weight: 500;
  }

  .centers {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .corners {
    align-content: space-between;
    display: grid;
    grid-template-areas: "a b c" "d e f" "g h i";
    grid-template-rows: 1fr 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr;
    line-height: calc(var(--square-size) / 3);
  }
`;

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
    number_or_hints.push(
      <div className="number">
        <span>{number}</span>
      </div>
    );
  } else {
    if (corners !== null) {
      number_or_hints.push(makeCorners(corners));
    }
    if (centers !== null) {
      number_or_hints.push(makeCenters(centers));
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
  if (locked && settings.get("highlightLocked")) {
    classes.push("locked");
  }
  return (
    <StyledSquare className={`${classes.join(" ")}`} data-index={index}>
      {cursor}
      {number_or_hints}
    </StyledSquare>
  );
}

function makeCorners(corners) {
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
    <div className="corners">
      {cornerEntries.map(({ n, area }) => (
        <span style={{ gridArea: area }}>{n}</span>
      ))}
    </div>
  );
}

function makeCenters(centers) {
  return (
    <div className="centers">
      {[...centers].sort().map((n) => (
        <span>{n}</span>
      ))}
    </div>
  );
}

const Cursor = styled.div`
  border: solid 1px ${(p) => p.theme.base.brighten(0.2)};
  box-sizing: border-box;
`;
