import { darkThemeColors, lightThemeColors } from "../tokens/colors/values";
import { fonts } from "../tokens/fonts";
import { radii } from "../tokens/radii/values";
import { spaces } from "../tokens/space";
import {
  fontSizes,
  fontWeights,
  headings,
  letterSpacings,
  lineHeights,
  texts,
} from "../tokens/typography";
import { zIndices } from "../tokens/z-indices";

const commonStyles = {
  fontSize: fontSizes,
  letterSpacing: letterSpacings,
  lineHeight: lineHeights,
  fontWeight: fontWeights,
  borderRadius: radii,
  space: spaces,
  heading: headings,
  text: texts,
  zIndices: zIndices,
  font: fonts,
};

export const lightTheme = {
  ...commonStyles,
  color: lightThemeColors,
};

export const darkTheme = {
  ...commonStyles,
  color: darkThemeColors,
};
