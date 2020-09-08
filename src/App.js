import React, { useCallback, useEffect, useRef, useState } from "react";
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
      className={`button ${props.active ? "active" : ""}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function Square(props) {
  return (
    <div
      className={`square ${props.selected ? "selected" : ""}`}
      data-index={props.index}
    >
      {props.value}
    </div>
  );
}

function App() {
  const is_selecting = useRef(false);
  const [mode, setMode] = useState(Mode.normal);
  const [numbers, setNumbers] = useState(new Array(81).fill(null));
  const [selection, setSelection] = useState(new Set());

  const clearSelection = useCallback(() => {
    setSelection(new Set());
  }, [setSelection]);

  const selectSquare = useCallback(
    (i) => {
      console.log(`selectSquare(${i})`);
      setSelection((selection) => {
        const newSelection = new Set(selection);
        newSelection.add(i);
        return newSelection;
      });
    },
    [setSelection]
  );

  const writeDigit = useCallback(
    (digit) => {
      const newNumbers = numbers.slice();
      for (let item of selection) {
        newNumbers[item] = digit;
      }
      setNumbers(newNumbers);
    },
    [numbers, selection]
  );

  //
  // TOUCH
  //
  const selectTouchedSquares = useCallback(
    (e) => {
      for (let touch of e.changedTouches) {
        let square = document.elementFromPoint(touch.pageX, touch.pageY);
        let i = parseInt(square.getAttribute("data-index"));
        selectSquare(i);
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
  function handleButton(i) {}

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
      writeDigit(digit);
    },
    [selection.size, writeDigit]
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
    return <Square index={i} selected={selection.has(i)} value={numbers[i]} />;
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
        <Button onClick={() => handleButton(1)}>1</Button>
        <Button onClick={() => handleButton(2)}>2</Button>
        <Button onClick={() => handleButton(3)}>3</Button>
        <Button onClick={() => handleButton(4)}>4</Button>
        <Button onClick={() => handleButton(5)}>5</Button>
        <Button onClick={() => handleButton(6)}>6</Button>
        <Button onClick={() => handleButton(7)}>7</Button>
        <Button onClick={() => handleButton(8)}>8</Button>
        <Button onClick={() => handleButton(9)}>9</Button>
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
