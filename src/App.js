import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_GAME_STATE,
  EMPTY_SET,
  addCenter,
  addCorner,
  anyContains,
  removeCenter,
  removeCorner,
  setNumber,
} from "./Gamestate.js";
import "./App.sass";

const Mode = {
  normal: 1,
  corner: 2,
  center: 3,
};

function ButtonRow(props) {
  return (
    <div className="button-row">
      <span>{props.label}</span>
      {props.children}
    </div>
  );
}

function Button(props) {
  return (
    <button
      className={`button ${props.active ? "active" : ""} ${
        props.large ? "large" : ""
      }`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function Square(props) {
  let inner = null;
  if (props.number !== null) {
    inner = <span className="number">{props.number}</span>;
  } else {
    inner = (
      <>
        <span className="corner">{props.corner}</span>
        <span className="center">{props.center}</span>
      </>
    );
  }
  return (
    <div
      className={`square ${props.selected ? "selected" : ""}`}
      data-index={props.index}
    >
      {inner}
    </div>
  );
}

function App() {
  const [mode, setMode] = useState(Mode.normal);
  const [gamestate, setGamestate] = useState(EMPTY_GAME_STATE);
  const [selection, setSelection] = useState(EMPTY_SET);

  const clearSelection = useCallback(() => {
    setSelection(new Set());
  }, []);

  const selectSquare = useCallback((i) => {
    console.log(`selectSquare(${i})`);
    setSelection((selection) => {
      const newSelection = new Set(selection);
      newSelection.add(i);
      return newSelection;
    });
  }, []);

  const inputDigit = useCallback(
    (digit) => {
      console.log(`inputDigit(${digit})`);
      setGamestate((gamestate) => {
        switch (mode) {
          case Mode.normal:
            return setNumber(gamestate, selection, digit);
          case Mode.corner:
            if (anyContains(gamestate.corners, selection, digit)) {
              return removeCorner(gamestate, selection, digit);
            } else {
              return addCorner(gamestate, selection, digit);
            }
          case Mode.center:
            if (anyContains(gamestate.centers, selection, digit)) {
              return removeCenter(gamestate, selection, digit);
            } else {
              return addCenter(gamestate, selection, digit);
            }
          default:
            return "this is not what the gamestate should be";
        }
      });
    },
    [mode, selection]
  );

  //
  // TOUCH
  //
  const selectTouchedSquares = useCallback(
    (e) => {
      for (let touch of e.changedTouches) {
        let element = document.elementFromPoint(touch.pageX, touch.pageY);
        while (element !== null) {
          if (element.hasAttribute("data-index")) break;
          element = element.parentElement;
        }
        if (element != null) {
          let i = parseInt(element.getAttribute("data-index"));
          selectSquare(i);
        }
      }
    },
    [selectSquare]
  );

  const handleTouchMove = useCallback(
    (e) => {
      console.log(`handleTouchMove()`);
      selectTouchedSquares(e);
    },
    [selectTouchedSquares]
  );

  const handleTouchStart = useCallback(
    (e) => {
      console.log(`handleTouchStart()`);
      e.preventDefault();
      if (e.touches.length === 1 && !e.ctrlKey) {
        clearSelection();
      }
      selectTouchedSquares(e);
    },
    [clearSelection, selectTouchedSquares]
  );

  //
  // MOUSE
  //

  //
  // KEYBOARD
  //
  const handleKeyDown = useCallback(
    (e) => {
      if (selection.size === 0 || !"123456789".includes(e.key)) {
        return;
      }
      const digit = Number(e.key).valueOf();
      if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(digit)) {
        return;
      }
      inputDigit(digit);
    },
    [selection.size, inputDigit]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  //
  // RENDER
  //
  function renderSquare(ibox, isquare) {
    const i = indexbox(ibox, isquare);
    return (
      <Square
        index={i}
        selected={selection.has(i)}
        number={gamestate.numbers[i]}
        corner={gamestate.corners[i]}
        center={gamestate.centers[i]}
      />
    );
  }

  function renderBox(i) {
    return (
      <div className="box">
        {renderSquare(i, 0)}
        {renderSquare(i, 1)}
        {renderSquare(i, 2)}
        {renderSquare(i, 3)}
        {renderSquare(i, 4)}
        {renderSquare(i, 5)}
        {renderSquare(i, 6)}
        {renderSquare(i, 7)}
        {renderSquare(i, 8)}
      </div>
    );
  }

  const board = useRef(null);
  useEffect(() => {
    const node = board.current;
    node.addEventListener("touchmove", handleTouchMove);
    node.addEventListener("touchstart", handleTouchStart);
    return () => {
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchstart", handleTouchStart);
    };
  }, [handleTouchMove, handleTouchStart]);

  return (
    <>
      <div ref={board} className="board" onTouchMove={handleTouchMove}>
        {renderBox(0)}
        {renderBox(1)}
        {renderBox(2)}
        {renderBox(3)}
        {renderBox(4)}
        {renderBox(5)}
        {renderBox(6)}
        {renderBox(7)}
        {renderBox(8)}
      </div>
      <ButtonRow label="mode">
        <Button
          active={mode === Mode.normal}
          onClick={() => setMode(Mode.normal)}
        >
          normal
        </Button>
        <Button
          active={mode === Mode.corner}
          onClick={() => setMode(Mode.corner)}
        >
          corner
        </Button>
        <Button
          active={mode === Mode.center}
          onClick={() => setMode(Mode.center)}
        >
          center
        </Button>
      </ButtonRow>
      <ButtonRow label="input">
        <Button large onClick={() => inputDigit(1)}>
          1
        </Button>
        <Button large onClick={() => inputDigit(2)}>
          2
        </Button>
        <Button large onClick={() => inputDigit(3)}>
          3
        </Button>
        <Button large onClick={() => inputDigit(4)}>
          4
        </Button>
        <Button large onClick={() => inputDigit(5)}>
          5
        </Button>
        <Button large onClick={() => inputDigit(6)}>
          6
        </Button>
        <Button large onClick={() => inputDigit(7)}>
          7
        </Button>
        <Button large onClick={() => inputDigit(8)}>
          8
        </Button>
        <Button large onClick={() => inputDigit(9)}>
          9
        </Button>
        <Button large onClick={() => inputDigit(null)}>
          ⌫
        </Button>
      </ButtonRow>
      <ButtonRow label="tools">
        <Button>undo</Button>
        <Button>redo</Button>
      </ButtonRow>
    </>
  );
}

function indexbox(ibox, isquare) {
  const boxrow = Math.floor(ibox / 3);
  const boxcol = ibox % 3;
  const actualrow = boxrow * 3 + Math.floor(isquare / 3);
  const actualcol = boxcol * 3 + (isquare % 3);
  return actualrow * 9 + actualcol;
}

export default App;
