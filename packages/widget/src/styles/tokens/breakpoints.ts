import { appContainerName } from "./containers.css";

export const breakpoints = {
  mobile: 0,
  tablet: 520,
  // desktop: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;

const SPLIT_COLLAPSE_BREAKPOINT = 800;

const toPx = (breakpoint: Breakpoint | number) =>
  typeof breakpoint === "number" ? breakpoint : breakpoints[breakpoint];

export const minMediaQuery = (breakpoint: Breakpoint | number) =>
  `screen and (min-width: ${toPx(breakpoint)}px)`;

export const minContainerWidth = (
  containerName: string,
  breakpoint: Breakpoint | number
) => `${containerName} (min-width: ${toPx(breakpoint)}px)`;


export const splitExpandedContainerQuery = minContainerWidth(
  appContainerName,
  SPLIT_COLLAPSE_BREAKPOINT + 1
);

export const isSplitCollapsedWidth = (appContainerWidth: number) =>
  appContainerWidth <= SPLIT_COLLAPSE_BREAKPOINT;
