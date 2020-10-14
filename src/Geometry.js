import { Range, Set } from "immutable";

export function squareAt(x, y) {
  let element = document.elementFromPoint(x, y);
  while (element !== null) {
    if (element.hasAttribute("data-index")) break;
    element = element.parentElement;
  }
  if (element != null) {
    let i = parseInt(element.getAttribute("data-index"));
    return i;
  }
  return null;
}

export function neighbor(s, direction) {
  switch (direction) {
    case "left":
      return s % 9 > 0 ? s - 1 : null;
    case "down":
      return Math.floor(s / 9) < 8 ? s + 9 : null;
    case "up":
      return Math.floor(s / 9) > 0 ? s - 9 : null;
    case "right":
      return s % 9 < 8 ? s + 1 : null;
    default:
      console.log(
        `neighbor was called with an invalid direction: ${direction}`
      );
      return null;
  }
}

export function indexbox(ibox, isquare) {
  const boxrow = Math.floor(ibox / 3);
  const boxcol = ibox % 3;
  const actualrow = boxrow * 3 + Math.floor(isquare / 3);
  const actualcol = boxcol * 3 + (isquare % 3);
  return actualrow * 9 + actualcol;
}

export function row(n) {
  return Range(9 * n, 9 * n + 9);
}

export function col(n) {
  return Range(n, 81, 9);
}

export function box(n) {
  const boxrow = Math.floor(n / 3);
  const boxcol = n % 3;
  const base = 27 * boxrow + 3 * boxcol;
  return Range(base, base + 3).concat(
    Range(base + 9, base + 9 + 3),
    Range(base + 18, base + 18 + 3)
  );
}

export function rowOf(s) {
  const row = Math.floor(s / 9);
  return Set(Range(9 * row, 9 * row + 9));
}

export function colOf(s) {
  const col = s % 9;
  return Set(Range(col, 81, 9));
}

export function boxOf(s) {
  const boxrow = Math.floor(Math.floor(s / 9) / 3);
  const boxcol = Math.floor((s % 9) / 3);
  return Set(
    Range(3 * boxrow, 3 * (boxrow + 1)).flatMap((row) =>
      Range(9 * row + 3 * boxcol, 9 * row + 3 * (boxcol + 1))
    )
  );
}

export function affectedBy(s) {
  return Set.union([rowOf(s), colOf(s), boxOf(s)]);
}

export function rows() {
  return Range(0, 81, 9).map((s) => row(s));
}

export function cols() {
  return Range(0, 9).map((s) => col(s));
}

export function boxes() {
  return Range(0, 2);
}
