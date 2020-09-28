import chroma from "chroma-js";
import { Modes } from "./Gamestate.js";

function makeTheme(c) {
  const theme = {
    base: c,
    border: chroma("#a0a0a0"),
    button: c.darken(0.8),
  };
  return theme;
}

export const Themes = {
  red: makeTheme(chroma.lch(40, 35, 0)),
  orange: makeTheme(chroma.lch(40, 35, 45)),
  yellow: makeTheme(chroma.lch(40, 35, 90)),
  green: makeTheme(chroma.lch(40, 35, 135)),
  cyan: makeTheme(chroma.lch(40, 35, 180)),
  blue: makeTheme(chroma.lch(40, 35, 225)),
  indigo: makeTheme(chroma.lch(40, 35, 270)),
  purple: makeTheme(chroma.lch(40, 35, 315)),
};
Themes.default = Themes.yellow;

export const ModeTheme = {};
ModeTheme[Modes.normal] = Themes.green;
ModeTheme[Modes.corners] = Themes.cyan;
ModeTheme[Modes.centers] = Themes.blue;
