import chroma from "chroma-js";
import { Modes } from "./Gamestate.js";

function makeTheme(base) {
  const theme = { base: base };

  theme.background = chroma("#232729");
  theme.border = chroma("#606060");
  theme.text = chroma("#d1d2d0");
  theme.error = chroma.lch(20, 50, 30);

  theme.button = theme.base.darken(0.8);

  theme.square = chroma.lch(22, 3, 252);
  theme.squareSelected = chroma.mix(theme.square, theme.base, 0.7, "lab");
  theme.squareHighlighted = chroma.mix(theme.square, theme.base, 0.2, "lab");
  theme.squareError = chroma.mix(theme.square, theme.error, 0.5, "lab");
  theme.squareLocked = theme.square.darken(0.2);
  theme.squareSelectedError = chroma.mix(
    theme.squareSelected,
    theme.squareError,
    0.5,
    "lab"
  );

  return theme;
}

export const Themes = (() => {
  const t = {
    red: makeTheme(chroma.lch(45, 35, 0)),
    orange: makeTheme(chroma.lch(45, 35, 45)),
    yellow: makeTheme(chroma.lch(45, 35, 90)),
    green: makeTheme(chroma.lch(45, 35, 135)),
    cyan: makeTheme(chroma.lch(45, 35, 180)),
    blue: makeTheme(chroma.lch(45, 35, 225)),
    indigo: makeTheme(chroma.lch(45, 35, 270)),
    purple: makeTheme(chroma.lch(45, 35, 315)),
    gray: makeTheme(chroma.lch(45, 0, 0)),
  };
  t.default = t.gray;
  return t;
})();

export const ModeTheme = {
  [Modes.normal]: Themes.green,
  [Modes.corners]: Themes.cyan,
  [Modes.centers]: Themes.blue,
};
