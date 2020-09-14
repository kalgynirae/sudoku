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
