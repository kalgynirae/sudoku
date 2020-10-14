import "normalize.css";

import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Set } from "immutable";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ThemeProvider } from "styled-components";
import { createGlobalStyle } from "styled-components";

import { Board, BoardSizer } from "./Board.js";
import { Button, ButtonRow, TopControls } from "./Buttons.js";
import {
  Action,
  canRedo,
  canUndo,
  createBoard,
  createGamestate,
  getErrors,
  Modes,
  updateGamestate,
} from "./Gamestate.js";
import { squareAt } from "./Geometry.js";
import { copyBoardAsURL, decodeBoard, encodeBoard } from "./Loader.js";
import {
  INITIAL_SELECTION,
  SelectionActions,
  updateSelection,
} from "./Selection";
import { INITIAL_SETTINGS, Settings, updateSettings } from "./Settings.js";
import { ModeTheme, Themes } from "./Theme.js";

const searchParams = new URLSearchParams(window.location.search);
const initialBoard = searchParams.has("board")
  ? decodeBoard(searchParams.get("board"))
  : createBoard(null);

export default function App() {
  const [mode, setMode] = useState(Modes.normal);
  const [focusDigit, setFocusDigit] = useState(null);
  const [gamestate, dispatchGamestate] = useReducer(updateGamestate, null, () =>
    createGamestate(initialBoard)
  );
  const [selection, dispatchSelection] = useReducer(
    updateSelection,
    INITIAL_SELECTION
  );
  const [settings, dispatchSettings] = useReducer(
    updateSettings,
    INITIAL_SETTINGS
  );

  //
  // STATE
  //
  const currentBoard = gamestate.getIn(["boards", gamestate.get("index")]);
  const currentErrors = useMemo(
    () => (settings.get("showErrors") ? getErrors(currentBoard) : Set()),
    [currentBoard, settings]
  );

  const selectSquareAtCoordinates = useCallback((x, y) => {
    console.log(`selectSquareAtCoordinates(${x}, ${y})`);
    const i = squareAt(x, y);
    if (i !== null) {
      dispatchSelection({
        action: SelectionActions.selectSquare,
        squareIndex: i,
      });
    }
  }, []);

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
        dispatchSelection({ action: SelectionActions.clear });
      }
      selectTouchedSquares(e);
    },
    [selectTouchedSquares]
  );

  //
  // MOUSE
  //
  const handleMouseDown = useCallback(
    (e) => {
      console.log(`handleMouseDown()`);
      if (!e.ctrlKey && !e.shiftKey) {
        dispatchSelection({ action: SelectionActions.clear });
      }
      selectSquareAtCoordinates(e.pageX, e.pageY);
    },
    [selectSquareAtCoordinates]
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
  const moveCursor = useCallback((e) => {
    if (!e.shiftKey && !e.ctrlKey) {
      dispatchSelection({ action: SelectionActions.clear });
    }
    dispatchSelection({
      action: SelectionActions.selectDirection,
      direction: e.key.substring(5).toLowerCase(),
    });
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "Escape":
          dispatchSelection({ action: SelectionActions.clear });
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
        case "z":
          if (canUndo) {
            dispatchGamestate({ action: Action.undo });
          }
          break;
        default:
          console.log(`Unhandled keydown: ${e}`);
          return;
      }
      e.preventDefault();
    },
    [inputDigit, moveCursor]
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
      <BoardSizer>
        <TopControls
          canRedo={canRedo(gamestate)}
          canUndo={canUndo(gamestate)}
          dispatchGamestate={dispatchGamestate}
          focusDigit={focusDigit}
          setFocusDigit={setFocusDigit}
        />
        <ThemeProvider theme={ModeTheme[mode]}>
          <Board
            boardAreaRef={boardArea}
            handleTouchMove={handleTouchMove}
            board={currentBoard}
            errors={currentErrors}
            focusDigit={focusDigit}
            selection={selection}
            settings={settings}
          />
        </ThemeProvider>
      </BoardSizer>
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
    --border-radius: 10px;
    --font-serif: "Literata", serif;
    --font-sans: "Inter", sans-serif;
    --font-hint: "Inconsolata", monospace;
  }

  body {
    background-color: ${(p) => p.theme.background};
    color: ${(p) => p.theme.text};
    font-family: var(--font-sans);
    line-height: 1;
    margin: 0;
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
    margin: 0 1rem;
  }
  #root > * + * {
    margin-top: 1rem;
  }

  a {
    color: inherit;
  }
`;
