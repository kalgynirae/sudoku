import React from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

export const StyledButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  & > * {
    flex: 0 0 auto;
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
  background: ${(p) => p.theme.button.darken(0.4)};
  border: solid 1px black;
  border-radius: var(--border-radius);
  color: ${(p) => p.theme.text};
  font-size: 1.5em;
  line-height: 1.8;
  padding: 0 0.5em;
  text-shadow: 1px 1px 0px black;
  touch-action: none;
`;

const StyledButton = styled(StyledButtonBase)`
  background: linear-gradient(
    to bottom,
    ${(p) => p.theme.button} 30%,
    ${(p) => p.theme.button.darken(0.2)} 100%
  );
  box-shadow: inset 0px 1px 0px ${(p) => p.theme.button.brighten(0.3)};
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
      ${(p) => p.theme.button.darken(0.2)} 20%,
      ${(p) => p.theme.button.darken(0.1)} 100%
    );
    box-shadow: inset 0px 0px 1px ${(p) => p.theme.button.brighten(1)};
  }
  &:disabled {
    background: ${(props) => props.theme.button.desaturate(1)};
    box-shadow: none;
    color: gray;
  }
`;

export function Button({
  children,
  className,
  active,
  enabled,
  large,
  onClick,
  theme,
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

export function FocusSelector() {
  return (
    <ButtonRow>
      <StyledButtonBase>
        <FontAwesomeIcon icon={faSearch} size="sm" />
      </StyledButtonBase>
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
