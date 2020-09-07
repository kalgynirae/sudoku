import React, { useEffect, useState } from 'react';
import './App.css';

function Square(props) {
  return (
    <div
      className={`square ${props.selected ? "selected": ""}`}
      onMouseEnter={props.onMouseEnter}
      onMouseDown={props.onMouseDown}
    >
      {props.value}
    </div>
  );
}

function Board() {
  const [mouseDown, setMouseDown] = useState(false);
  const [numbers, setNumbers] = useState(new Array(81).fill(null));
  const [selection, setSelection] = useState(new Set());

  function handleMouseEnter(i) {
    if (!mouseDown) {
      return;
    }
    const newSelection = new Set(selection);
    newSelection.add(i);
    setSelection(newSelection);
  }

  function handleMouseDown(i) {
    setMouseDown(true);
    const newSelection = new Set();
    if (i !== null) {
      newSelection.add(i);
    }
    setSelection(newSelection);
  }

  function handleMouseUp() {
    setMouseDown(false);
  }

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
  }, [setMouseDown]);

  function renderSquare(ibox, isquare) {
    const i = indexbox(ibox, isquare);
    return (
      <Square
        selected={selection.has(i)}
        value={numbers[i]}
        onMouseEnter={() => handleMouseEnter(i)}
        onMouseDown={() => handleMouseDown(i)}
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

  return (
    <div className="board">
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
  );
}

function indexbox(ibox, isquare) {
  const boxrow = Math.floor(ibox / 3);
  const boxcol = ibox % 3;
  const actualrow = boxrow*3 + Math.floor(isquare / 3);
  const actualcol = boxcol*3 + (isquare % 3);
  return actualrow*9 + actualcol;
}

function App() {
  return (
    <Board numbers={new Array(81).fill(0)}/>
  );
}

export default App;
