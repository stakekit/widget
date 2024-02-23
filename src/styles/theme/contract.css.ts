import { createGlobalThemeContract } from "@vanilla-extract/css";
import { spacesContract } from "../tokens/space";
import { zIndicesContract } from "../tokens/z-indices";
import {
  fontSizesContract,
  fontWeightsContract,
  headingsContract,
  letterSpacingsContract,
  lineHeightsContract,
  textsContract,
} from "../tokens/typography";
import { fontsContract } from "../tokens/fonts";
import { colorsContract } from "../tokens/colors/contract";
import { radiiContract } from "../tokens/radii/contract";

export const vars = createGlobalThemeContract(
  {
    color: colorsContract,
    fontSize: fontSizesContract,
    letterSpacing: letterSpacingsContract,
    lineHeight: lineHeightsContract,
    fontWeight: fontWeightsContract,
    borderRadius: radiiContract,
    space: spacesContract,
    heading: headingsContract,
    text: textsContract,
    zIndices: zIndicesContract,
    font: fontsContract,
  },
  (_value, path) =>
    `sk-${path
      .join("-")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()}`
);

export const id = "stakekit";
export const rootSelector = `[data-rk="${id}"]`;
