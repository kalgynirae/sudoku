import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_GAME_STATE,
  addCenter,
  addCorner,
  anyContains,
  removeCenter,
  removeCorner,
  setNumber,
} from "./Gamestate.js";
import { squareAt, indexbox, neighbor } from "./Geometry.js";
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
      disabled={props.enabled === false}
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
      className={`square ${props.selected ? "selected" : ""} ${
        props.cursor ? "cursor" : ""
      }`}
      data-index={props.index}
    >
      {inner}
    </div>
  );
}

function App() {
  const [mode, setMode] = useState(Mode.normal);
  const [gamestate, _setGamestate] = useState({
    stack: [EMPTY_GAME_STATE],
    index: 0,
  });
  const [selection, setSelection] = useState({ squares: [], cursor: null });

  //
  // STATE
  //
  const currentState = gamestate.stack[gamestate.index];

  const pushState = useCallback((newstatefunc) => {
    _setGamestate((gamestate) => {
      const newState = newstatefunc(gamestate.stack[gamestate.index]);
      const newStack = gamestate.stack.slice(0, gamestate.index + 1);
      newStack.push(newState);
      const newGamestate = { stack: newStack, index: gamestate.index + 1 };
      return newGamestate;
    });
  }, []);

  const undo = useCallback(() => {
    _setGamestate((gamestate) => {
      if (gamestate.index === 0) {
        return gamestate;
      }
      return {
        stack: gamestate.stack,
        index: gamestate.index - 1,
      };
    });
  }, []);

  const redo = useCallback(() => {
    _setGamestate((gamestate) => {
      if (gamestate.index === gamestate.stack.length - 1) {
        return gamestate;
      }
      return {
        stack: gamestate.stack,
        index: gamestate.index + 1,
      };
    });
  }, []);

  //
  // SELECTION
  //
  const clearSelection = useCallback(() => {
    setSelection((selection) => {
      const newSelection = { ...selection };
      newSelection.squares = [];
      return newSelection;
    });
  }, []);

  const selectSquare = useCallback((i) => {
    console.log(`selectSquare(${i})`);
    setSelection((selection) => {
      const newSelection = { ...selection };
      newSelection.squares = [...selection.squares];
      newSelection.squares.push(i);
      newSelection.cursor = i;
      return newSelection;
    });
  }, []);

  const selectSquareAtCoordinates = useCallback(
    (x, y) => {
      console.log(`selectSquareAtCoordinates(${x}, ${y})`);
      const i = squareAt(x, y);
      if (i !== null) {
        selectSquare(i);
      }
    },
    [selectSquare]
  );

  const selectDirection = useCallback(
    (direction) => {
      setSelection((selection) => {
        let i = neighbor(selection.cursor, direction) ?? selection.cursor;
        const newSelection = { ...selection };
        newSelection.squares = [...selection.squares, i];
        newSelection.cursor = i;
        return newSelection;
      });
    },
    [setSelection]
  );

  //
  // ACTIONS
  //
  const inputDigit = useCallback(
    (digit) => {
      console.log(`inputDigit(${digit})`);
      pushState((gamestate) => {
        switch (mode) {
          case Mode.normal:
            return setNumber(gamestate, selection.squares, digit);
          case Mode.corner:
            if (anyContains(gamestate.corners, selection.squares, digit)) {
              return removeCorner(gamestate, selection.squares, digit);
            } else {
              return addCorner(gamestate, selection.squares, digit);
            }
          case Mode.center:
            if (anyContains(gamestate.centers, selection.squares, digit)) {
              return removeCenter(gamestate, selection.squares, digit);
            } else {
              return addCenter(gamestate, selection.squares, digit);
            }
          default:
            return "this is not what the gamestate should be";
        }
      });
    },
    [pushState, mode, selection]
  );

  //
  // TOUCH
  //
  const selectTouchedSquares = useCallback(
    (e) => {
      for (let touch of e.changedTouches) {
        selectSquareAtCoordinates(touch.pageX, touch.pageY);
      }
    },
    [selectSquareAtCoordinates]
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
  const handleMouseDown = useCallback(
    (e) => {
      console.log(`handleMouseDown()`);
      if (!e.ctrlKey && !e.shiftKey) {
        clearSelection();
      }
      selectSquareAtCoordinates(e.pageX, e.pageY);
    },
    [clearSelection, selectSquareAtCoordinates]
  );

  const handleMouseMove = useCallback(
    (e) => {
      console.log(`handleMouseMove()`);
      if (e.buttons === 1) {
        selectSquareAtCoordinates(e.pageX, e.pageY);
      }
    },
    [selectSquareAtCoordinates]
  );

  //
  // KEYBOARD
  //
  const moveCursor = useCallback(
    (e) => {
      if (!e.shiftKey && !e.ctrlKey) {
        clearSelection();
      }
      selectDirection(e.key.substring(5).toLowerCase());
    },
    [clearSelection, selectDirection]
  );
  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "Escape":
          clearSelection();
          break;
        case "ArrowRight":
        case "ArrowLeft":
        case "ArrowUp":
        case "ArrowDown":
          moveCursor(e);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          inputDigit(Number(e.key).valueOf());
          break;
        default:
          console.log(`Unhandled keydown: ${e}`);
          return;
      }
      e.preventDefault();
    },
    [clearSelection, inputDigit, moveCursor]
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
        cursor={selection.cursor === i}
        selected={selection.squares.includes(i)}
        number={currentState.numbers[i]}
        corner={currentState.corners[i]}
        center={currentState.centers[i]}
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
    node.addEventListener("mousedown", handleMouseDown);
    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("touchmove", handleTouchMove);
    node.addEventListener("touchstart", handleTouchStart);
    return () => {
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchstart", handleTouchStart);
    };
  }, [handleMouseDown, handleMouseMove, handleTouchMove, handleTouchStart]);

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
        <Button onClick={() => undo()} enabled={gamestate.index > 0}>
          undo
        </Button>
        <Button
          onClick={() => redo()}
          enabled={gamestate.index < gamestate.stack.length - 1}
        >
          redo
        </Button>
      </ButtonRow>
    </>
  );
}

export default App;
