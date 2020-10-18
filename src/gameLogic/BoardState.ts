import * as Immutable from "immutable";

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
}
