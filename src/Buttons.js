import { faRedo, faSearch, faUndo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as immutable from "immutable";
import React from "react";
import styled, { ThemeProvider } from "styled-components";

import { SelectionAction } from "./Selection";
import { Themes } from "./Theme";

export const StyledButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  & > * {
    flex: 1 0 0;
  }

  &.stretch > * {
    flex: 0 1 100%;
  }

  &.large {
    font-size: 2em;
  }

  & > :not(:last-child) {
    border-right-width: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  & > :not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export function ButtonRow({ children, large, stretch }) {
  const classes = [];
  if (large) classes.push("large");
  if (stretch) classes.push("stretch");
  return (
    <StyledButtonRow className={classes.join(" ")}>{children}</StyledButtonRow>
  );
}

const StyledButtonBase = styled.div`
  background: ${(p) => p.theme.button.set("lch.c", 0)};
  border: solid 1px black;
  border-radius: var(--border-radius);
  box-shadow: inset 0 1px 0 0 ${(p) => p.theme.button.brighten(0.3)};
  color: inherit;
  font-size: 1.5em;
  line-height: 1.8;
  padding: 0 0.4em;
  text-shadow: 1px 1px 0px black;
  touch-action: none;
`;

const StyledButtonLabel = styled(StyledButtonBase)`
  color: ${(p) => p.theme.background};
  flex: 0 1 0;
`;

const StyledButton = styled(StyledButtonBase)`
  background: linear-gradient(
    to bottom,
    ${(p) => p.theme.button} 30%,
    ${(p) => p.theme.button.darken(0.2)} 100%
  );
  &:hover {
    background: linear-gradient(
      to bottom,
      ${(p) => p.theme.button.brighten(0.2)} 20%,
      ${(p) => p.theme.button} 100%
    );
  }
  &:active,
  &.active {
    background: linear-gradient(
      to bottom,
      ${(p) => p.theme.button.darken(0.3)} 20%,
      ${(p) => p.theme.button.darken(0.15)} 100%
    );
    box-shadow: inset 0 0 1px 0 ${(p) => p.theme.button.brighten(1.5)};
  }
  &:disabled {
    background: ${(props) => props.theme.button.desaturate(1)};
    box-shadow: none;
    color: gray;
  }

  & > svg {
    filter: drop-shadow(1px 1px 0 black);
  }
`;

export function Button({
  children,
  className,
  active,
  enabled,
  large,
  onClick,
}) {
  return (
    <StyledButton
      as="button"
      className={`button${active ? " active" : ""}${large ? " large" : ""}${
        className ? ` ${className}` : ""
      }`}
      disabled={enabled === false}
      onClick={onClick}
    >
      {children}
    </StyledButton>
  );
}

const StyledFocusSelector = styled.div`
  width: 30em;
`;

function FocusSelector({ selection, dispatchSelection }) {
  const buttons = immutable.Range(1, 10).map((i) => (
    <Button
      active={selection.focusDigit === i}
      onClick={() =>
        dispatchSelection({
          action: SelectionAction.focus,
          digit: selection.focusDigit === i ? null : i,
        })
      }
    >
      {i}
    </Button>
  ));
  return (
    <StyledFocusSelector>
      <ButtonRow>
        <StyledButtonLabel>
          <FontAwesomeIcon icon={faSearch} size="sm" />
        </StyledButtonLabel>
        {buttons}
      </ButtonRow>
    </StyledFocusSelector>
  );
}

const StyledUndoRedo = styled.div`
  width: 6em;
`;

export function UndoRedo({ canRedo, canUndo, onRedoClick, onUndoClick }) {
  return (
    <StyledUndoRedo>
      <ButtonRow>
        <Button onClick={onUndoClick} enabled={canUndo}>
          <FontAwesomeIcon icon={faUndo} size="sm" />
        </Button>
        <Button onClick={onRedoClick} enabled={canRedo}>
          <FontAwesomeIcon icon={faRedo} size="sm" />
        </Button>
      </ButtonRow>
    </StyledUndoRedo>
  );
}

const StyledTopControls = styled.div`
  display: flex;
  justify-content: space-between;
  width: var(--board-size);
  margin: 0 auto;
`;

export function TopControls({
  canRedo,
  canUndo,
  dispatchSelection,
  onRedoClick,
  onUndoClick,
  selection,
}) {
  return (
    <StyledTopControls>
      <ThemeProvider theme={Themes.gray}>
        <FocusSelector
          selection={selection}
          dispatchSelection={dispatchSelection}
        />
      </ThemeProvider>
      <ThemeProvider theme={Themes.red}>
        <UndoRedo
          canRedo={canRedo}
          canUndo={canUndo}
          onRedoClick={onRedoClick}
          onUndoClick={onUndoClick}
        />
      </ThemeProvider>
    </StyledTopControls>
  );
}
