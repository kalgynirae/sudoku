import React, {
  useCallback,
  useEffect,
  useMemo,
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
  canRedo,
  canUndo,
  createBoard,
  createGamestate,
  getErrors,
  updateGamestate,
} from "./Gamestate.js";
import { squareAt, neighbor } from "./Geometry.js";
import { Board } from "./Board.js";
import { Button, ButtonRow } from "./Buttons.js";
import { Themes, ModeTheme } from "./Colors.js";
import { decodeBoard, encodeBoard, copyBoardAsURL } from "./Loader.js";
import { Settings, INITIAL_SETTINGS, updateSettings } from "./Settings.js";
import styled, { createGlobalStyle } from "styled-components";
import "normalize.css";
import { Set } from "immutable";

const searchParams = new URLSearchParams(window.location.search);
const initialBoard = searchParams.has("board")
  ? decodeBoard(searchParams.get("board"))
  : createBoard(null);

export default function App() {
  const [mode, setMode] = useState(Modes.normal);
  const [gamestate, dispatchGamestate] = useReducer(updateGamestate, null, () =>
    createGamestate(initialBoard)
  );
  const [selection, setSelection] = useState({
    squares: [],
    cursor: null,
    usingCursor: false,
  });
  const [settings, dispatchSettings] = useReducer(
    updateSettings,
    INITIAL_SETTINGS
  );

  //
  // STATE
  //
  const currentBoard = gamestate.getIn(["boards", gamestate.get("index")]);
  const currentErrors = useMemo(
    () => (settings.get("highlightErrors") ? getErrors(currentBoard) : Set()),
    [currentBoard, settings]
  );

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
      dispatchGamestate({
        action: Action.input,
        squares: selection.squares,
        digit: digit,
        mode: mode,
        settings: settings,
      });
    },
    [mode, selection, settings]
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
          inputDigit(parseInt(e.key));
          break;
        case "Backspace":
          inputDigit(null);
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
        <ThemeProvider theme={Themes.red}>
          <ButtonRow>
            <Button
              onClick={() => dispatchGamestate({ action: Action.undo })}
              enabled={canUndo(gamestate)}
            >
              <FontAwesomeIcon icon={faUndo} size="sm" />
            </Button>
            <Button
              onClick={() => dispatchGamestate({ action: Action.redo })}
              enabled={canRedo(gamestate)}
            >
              <FontAwesomeIcon icon={faRedo} size="sm" />
            </Button>
          </ButtonRow>
        </ThemeProvider>
      </FlexRow>
      <ThemeProvider theme={ModeTheme[mode]}>
        <Board
          boardAreaRef={boardArea}
          handleTouchMove={handleTouchMove}
          board={currentBoard}
          errors={currentErrors}
          selection={selection}
          settings={settings}
        />
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
      <Settings settings={settings} dispatchSettings={dispatchSettings} />
      <p>
        Current board: <tt>{encodeBoard(currentBoard)}</tt>
      </p>
      <Button onClick={() => copyBoardAsURL(currentBoard)}>
        Copy current board URL
      </Button>
      <ol>
        <li>
          <a href="?">Empty puzzle</a>
        </li>
        <li>
          <a href="?board=7.4..6..9.8..1......3.2.45.........2.56...78.1.........25.3.1......4..6.9..5..3.7">
            #1
          </a>
        </li>
        <li>
          <a href="?board=....2.......738....5.4.6.7.1.......896.....41.8.6.1.2...25.71....9.8.7..3.......6">
            #2
          </a>
        </li>
      </ol>
    </ThemeProvider>
  );
}

const GlobalStyle = createGlobalStyle`
  :root {
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

  a {
    color: inherit;
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
