import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import {
  Action,
  Mode,
  INITIAL_GAMESTATE,
  canRedo,
  canUndo,
  updateGamestate,
} from "./Gamestate.js";
import { squareAt, indexbox, neighbor } from "./Geometry.js";
import Square from "./Square.js";
import "./App.sass";

function ButtonRow({ children, label, theme }) {
  return (
    <div className={`button-row theme-${theme}`}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function ButtonRowItem(props) {
  return (
    <Button
      {...props}
      className={(props.className ?? "") + " button-row-item"}
    />
  );
}

function Button({
  children,
  className,
  active,
  enabled,
  large,
  onClick,
  theme,
}) {
  return (
    <button
      className={`button${active ? " active" : ""}${large ? " large" : ""}${
        theme ? ` theme-${theme}` : ""
      }${className ? ` ${className}` : ""}`}
      disabled={enabled === false}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function App() {
  const [mode, setMode] = useState(Mode.normal);
  const [gamestate, dispatch] = useReducer(updateGamestate, INITIAL_GAMESTATE);
  const [selection, setSelection] = useState({ squares: [], cursor: null });

  //
  // STATE
  //
  const currentBoard = gamestate.getIn(["boards", gamestate.get("index")]);

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
      dispatch({
        type: Action.input,
        squares: selection.squares,
        digit: digit,
        mode: mode,
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
        has_cursor={selection.cursor === i}
        selected={selection.squares.includes(i)}
        number={currentBoard.get(i).get("number")}
        corners={currentBoard.get(i).get("corners")}
        centers={currentBoard.get(i).get("centers")}
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

  const boardArea = useRef(null);
  useEffect(() => {
    const node = boardArea.current;
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

  return [
    <div ref={boardArea} className="board-area">
      <ButtonRow label="tools">
        <ButtonRowItem
          onClick={() => dispatch({ type: Action.undo })}
          enabled={canUndo(gamestate)}
        >
          undo
        </ButtonRowItem>
        <ButtonRowItem
          onClick={() => dispatch({ type: Action.redo })}
          enabled={canRedo(gamestate)}
        >
          redo
        </ButtonRowItem>
      </ButtonRow>
      <div className="board-sizer">
        <div className="board" onTouchMove={handleTouchMove}>
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
      </div>
    </div>,
    <div>
      <ButtonRow label="mode">
        <ButtonRowItem
          active={mode === Mode.normal}
          onClick={() => setMode(Mode.normal)}
          theme="normal"
        >
          normal
        </ButtonRowItem>
        <ButtonRowItem
          active={mode === Mode.corners}
          onClick={() => setMode(Mode.corners)}
          theme="corners"
        >
          corner
        </ButtonRowItem>
        <ButtonRowItem
          active={mode === Mode.centers}
          onClick={() => setMode(Mode.centers)}
          theme="centers"
        >
          center
        </ButtonRowItem>
      </ButtonRow>
      <ButtonRow label="input" theme={mode}>
        <ButtonRowItem large onClick={() => inputDigit(1)}>
          1
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(2)}>
          2
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(3)}>
          3
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(4)}>
          4
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(5)}>
          5
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(6)}>
          6
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(7)}>
          7
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(8)}>
          8
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(9)}>
          9
        </ButtonRowItem>
        <ButtonRowItem large onClick={() => inputDigit(null)}>
          <FontAwesomeIcon icon={faBackspace} />
        </ButtonRowItem>
      </ButtonRow>
    </div>,
  ];
}

export default App;
