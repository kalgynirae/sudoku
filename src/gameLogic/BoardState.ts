import * as Immutable from "immutable";

import { box, col, row } from "../Geometry.js";

export type BoardSquareProps = {
  number: number | null;
  corners: Immutable.Set<number>;
  centers: Immutable.Set<number>;
  locked: boolean;
};

const boardSquareDefaultValues: BoardSquareProps = {
  number: null,
  corners: Immutable.Set(),
  centers: Immutable.Set(),
  locked: false,
};

export const createBoardSquare: Immutable.Record.Factory<BoardSquareProps> = Immutable.Record(
  boardSquareDefaultValues
);

export type BoardSquare = Immutable.Record<BoardSquareProps>;

function nullthrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("unexpected null value");
  }
  return value;
}

export function squareIncludesDigit(square: BoardSquare, digit: number) {
  return digit === null
    ? false
    : square.get("number") === digit ||
        square.get("corners").includes(digit) ||
        square.get("centers").includes(digit);
}

export default class BoardState {
  constructor(public readonly squares: Immutable.List<BoardSquare>) {}

  static empty() {
    return BoardState.withNumbers(Immutable.Repeat(null, 81));
  }

  static withNumbers(numbers: Iterable<number | null>) {
    return new BoardState(
      Immutable.Seq(numbers)
        .map((number) =>
          createBoardSquare({
            number: number,
            locked: number !== null,
          })
        )
        .toList()
    );
  }

  getErrors() {
    const rows = Immutable.Range(0, 9).map((r) => row(r));
    const columns = Immutable.Range(0, 9).map((c) => col(c));
    const boxes = Immutable.Range(0, 9).map((b) => box(b));
    const sections = rows.concat(columns, boxes);
    const errorSquares = Immutable.Set().asMutable();
    sections.forEach((section) => {
      const squareNumbers = Immutable.Map(
        section.map((s) => [s, nullthrows(this.squares.get(s)).get("number")])
      ).filter((v) => v !== null);
      const numberCounts = squareNumbers.countBy((number) => number);
      squareNumbers.forEach((number, s) => {
        if (nullthrows(numberCounts.get(number)) > 1) {
          errorSquares.add(s);
        }
      });
    });
    return errorSquares.asImmutable();
  }
}
