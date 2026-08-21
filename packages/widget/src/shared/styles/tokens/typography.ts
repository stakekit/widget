import type { CompleteTheme } from "../../../public-api/theme";

export const letterSpacings: CompleteTheme["letterSpacing"] = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
};

export const lineHeights: CompleteTheme["lineHeight"] = {
  none: "1",
  shorter: "1.25",
  short: "1.375",
  base: "1.5",
  tall: "1.625",
  taller: "2",
  xs: "1rem",
  sm: "1.25rem",
  md: "1.5rem",
  lg: "1.75rem",
  xl: "1.75rem",
  "2xl": "2.25rem",
  "3xl": "2.5rem",
  "4xl": "1",
  "5xl": "1",
  "6xl": "1",
};

export const fontWeights: CompleteTheme["fontWeight"] = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",

  modalHeading: "600",
  tokenSelect: "700",
  primaryButton: "700",
  secondaryButton: "700",
};

export const fontSizes: CompleteTheme["fontSize"] = {
  xs: "0.615rem",
  sm: "0.717rem",
  md: "0.85rem",
  lg: "1rem",
  lgx: "1.125rem",
  xl: "1.3125rem",
  "2xl": "1.563rem",
  "3xl": "1.953rem",
  "4xl": "2.441rem",
  "5xl": "3.052rem",
  "6xl": "3.815rem",
} as const;

export type Heading = keyof CompleteTheme["heading"];

export const headings: CompleteTheme["heading"] = {
  h1: {
    mobile: { fontSize: fontSizes["3xl"] },
    tablet: { fontSize: fontSizes["4xl"] },
  },
  h2: {
    mobile: { fontSize: fontSizes["2xl"] },
    tablet: { fontSize: fontSizes["3xl"] },
  },
  h3: {
    mobile: { fontSize: fontSizes.xl },
    tablet: { fontSize: fontSizes["2xl"] },
  },
  h4: {
    mobile: { fontSize: fontSizes.lgx },
    tablet: { fontSize: fontSizes.lgx },
  },
};

export type Text = keyof CompleteTheme["text"];

export const texts: CompleteTheme["text"] = {
  large: {
    mobile: { fontSize: fontSizes.lg },
    tablet: { fontSize: fontSizes.lg },
  },
  medium: {
    mobile: { fontSize: fontSizes.md },
    tablet: { fontSize: fontSizes.md },
  },
  small: {
    mobile: { fontSize: fontSizes.sm },
    tablet: { fontSize: fontSizes.sm },
  },
};
