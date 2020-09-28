import React from "react";
import styled from "styled-components";
import { Themes } from "./Colors.js";

export const StyledButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0.5rem;

  & > * {
    flex: 0 0 auto;
  }

  &.stretch > * {
    flex: 0 1 100%;
  }

  &.large {
    font-size: 2em;
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

const StyledButton = styled.button`
  background: linear-gradient(
    to bottom,
    ${(p) => p.theme.button} 30%,
    ${(p) => p.theme.button.darken(0.2)} 100%
  );
  border: solid 1px black;
  border-right-width: 0;
  box-shadow: inset 0px 1px 0px ${(p) => p.theme.button.brighten(0.3)};
  color: white;
  font-size: 1.5em;
  line-height: 2;
  text-shadow: 1px 1px 0px black;

  &:hover {
    background: linear-gradient(
      to bottom,
      ${(p) => p.theme.button.brighten(0.2)} 20%,
      ${(p) => p.theme.button} 100%
    );
  }
  &:active {
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

  &:first-child {
    border-radius: 10px 0 0 10px;
  }
  &:last-child {
    border-right-width: 1px;
    border-radius: 0 10px 10px 0;
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
