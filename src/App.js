import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace, faRedo, faUndo } from "@fortawesome/free-solid-svg-icons";
import { ThemeProvider } from "styled-components";
import {
  Action,
  Modes,
  INITIAL_GAMESTATE,
  canRedo,
  canUndo,
  updateGamestate,
} from "./Gamestate.js";
import { squareAt, indexbox, neighbor } from "./Geometry.js";
import Square from "./Square.js";
import { Board, Box } from "./Board.js";
import { Button, ButtonRow } from "./Buttons.js";
import { Themes, ModeTheme } from "./Colors.js";
import styled, { createGlobalStyle } from "styled-components";

export default function App() {
  const [mode, setMode] = useState(Modes.normal);
  const [gamestate, dispatch] = useReducer(updateGamestate, INITIAL_GAMESTATE);
  const [selection, setSelection] = useState({
    squares: [],
    cursor: null,
    usingCursor: false,
  });

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
      if (selection.squares.includes(i)) {
        return selection;
      }
      const newSelection = { ...selection };
      newSelection.squares = [...selection.squares];
      newSelection.squares.push(i);
      newSelection.cursor = i;
      newSelection.usingCursor = false;
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
        newSelection.usingCursor = true;
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
        hasCursor={selection.usingCursor && selection.cursor === i}
        selected={selection.squares.includes(i)}
        number={currentBoard.get(i).get("number")}
        corners={currentBoard.get(i).get("corners")}
        centers={currentBoard.get(i).get("centers")}
      />
    );
  }

  function renderBox(i) {
    return (
      <Box>
        {renderSquare(i, 0)}
        {renderSquare(i, 1)}
        {renderSquare(i, 2)}
        {renderSquare(i, 3)}
        {renderSquare(i, 4)}
        {renderSquare(i, 5)}
        {renderSquare(i, 6)}
        {renderSquare(i, 7)}
        {renderSquare(i, 8)}
      </Box>
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

  return (
    <ThemeProvider theme={Themes.default}>
      <GlobalStyle />
      <FlexRow>
        <FocusSelector />
        <ButtonRow>
          <Button
            onClick={() => dispatch({ type: Action.undo })}
            enabled={canUndo(gamestate)}
          >
            <FontAwesomeIcon icon={faUndo} size="sm" />
          </Button>
          <Button
            onClick={() => dispatch({ type: Action.redo })}
            enabled={canRedo(gamestate)}
          >
            <FontAwesomeIcon icon={faRedo} size="sm" />
          </Button>
        </ButtonRow>
      </FlexRow>
      <ThemeProvider theme={ModeTheme[mode]}>
        <Board boardAreaRef={boardArea} handleTouchMove={handleTouchMove}>
          {renderBox(0)}
          {renderBox(1)}
          {renderBox(2)}
          {renderBox(3)}
          {renderBox(4)}
          {renderBox(5)}
          {renderBox(6)}
          {renderBox(7)}
          {renderBox(8)}
        </Board>
      </ThemeProvider>
      <div>
        <ButtonRow stretch>
          <ThemeProvider theme={ModeTheme[Modes.normal]}>
            <Button
              active={mode === Modes.normal}
              onClick={() => setMode(Modes.normal)}
              theme="normal"
            >
              normal
            </Button>
          </ThemeProvider>
          <ThemeProvider theme={ModeTheme[Modes.corners]}>
            <Button
              active={mode === Modes.corners}
              onClick={() => setMode(Modes.corners)}
              theme="corners"
            >
              corner
            </Button>
          </ThemeProvider>
          <ThemeProvider theme={ModeTheme[Modes.centers]}>
            <Button
              active={mode === Modes.centers}
              onClick={() => setMode(Modes.centers)}
              theme="centers"
            >
              center
            </Button>
          </ThemeProvider>
        </ButtonRow>
        <ThemeProvider theme={ModeTheme[mode]}>
          <ButtonRow large stretch>
            <Button onClick={() => inputDigit(1)}>1</Button>
            <Button onClick={() => inputDigit(2)}>2</Button>
            <Button onClick={() => inputDigit(3)}>3</Button>
            <Button onClick={() => inputDigit(4)}>4</Button>
            <Button onClick={() => inputDigit(5)}>5</Button>
            <Button onClick={() => inputDigit(6)}>6</Button>
            <Button onClick={() => inputDigit(7)}>7</Button>
            <Button onClick={() => inputDigit(8)}>8</Button>
            <Button onClick={() => inputDigit(9)}>9</Button>
            <Button onClick={() => inputDigit(null)}>
              <FontAwesomeIcon icon={faBackspace} size="sm" />
            </Button>
          </ButtonRow>
        </ThemeProvider>
      </div>
    </ThemeProvider>
  );
}

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  ul[class], ol[class] {
    list-style: none;
    padding: 0;
  }

  body, h1, h2, h3, h4, p, ul[class], ol[class], li, figure, figcaption, blockquote, dl, dd {
    margin: 0;
  }

  input, button, textarea, select {
    font: inherit;
  }

  :root {
    --square-gap: 2px;
    --box-gap: 4px;
    --square-size: 4rem;
    --button-hue: 120;
    --font-serif: "Literata", serif;
    --font-sans: "Inter", sans-serif;
    --font-hint: "Inconsolata", monospace;
  }

  body {
    background-color: ${(p) => p.theme.background};
    color: ${(p) => p.theme.text};
    font-family: var(--font-sans);
    line-height: 1;
    touch-action: manipulation;
  }

  .title {
    font-family: var(--font-serif);
    margin-top: 0.5em;
    text-align: center;
  }

  #root {
    display: flex;
    flex-direction: column;
    margin-top: 1rem;
  }

  #root > * {
    flex-grow: 1;
  }

  .box {
  }
`;

const FlexRow = styled.div`
  display: flex;
  justify-content: center;
`;
function FocusSelector() {
  return (
    <ButtonRow>
      <Button>1</Button>
      <Button>2</Button>
      <Button>3</Button>
      <Button>4</Button>
      <Button>5</Button>
      <Button>6</Button>
      <Button>7</Button>
      <Button>8</Button>
      <Button>9</Button>
    </ButtonRow>
  );
}
