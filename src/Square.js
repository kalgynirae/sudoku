import React from "react";

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
  has_cursor,
  index,
  number,
  selected,
}) {
  let cursor = null;
  if (has_cursor) {
    cursor = <div className="cursor" />;
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

  return (
    <div className={`square${selected ? " selected" : ""}`} data-index={index}>
      {cursor}
      {number_or_hints}
    </div>
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
