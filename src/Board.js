import React from "react";
import styled from "styled-components";

export function Board({ children, handleTouchMove, boardAreaRef }) {
  return (
    <BoardArea ref={boardAreaRef}>
      <BoardSizer>
        <BoardGrid onTouchMove={handleTouchMove}>{children}</BoardGrid>
      </BoardSizer>
    </BoardArea>
  );
}

const BoardArea = styled.div`
  border: 1px solid ${(p) => p.theme.border};
`;

const BoardSizer = styled.div`
  position: relative;
  height: calc(36rem + 10px);
  width: calc(36rem + 10px);
  margin: 1rem auto;
`;

const BoardGrid = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  column-gap: var(--box-gap);
  row-gap: var(--box-gap);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
`;

export const Box = styled.div`
  column-gap: var(--square-gap);
  row-gap: var(--square-gap);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  user-select: none;
`;
