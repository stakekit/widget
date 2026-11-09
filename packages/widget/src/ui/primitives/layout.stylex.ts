import * as stylex from "@stylexjs/stylex";

/**
 * Private to the layout primitives: each responsive prop carries one value
 * per container size, so a larger size's value never replaces the base one
 * (StyleX merges per property and the last one wins). Every primitive sets
 * all of its variables, so a nested primitive never inherits its parent's.
 */
export const layoutVars = stylex.defineVars({
  direction: "column",
  directionSm: "column",
  directionMd: "column",
  directionSplit: "column",
  gap: "0px",
  gapSm: "0px",
  gapMd: "0px",
  gapSplit: "0px",
  align: "stretch",
  alignSm: "stretch",
  alignMd: "stretch",
  alignSplit: "stretch",
  justify: "flex-start",
  justifySm: "flex-start",
  justifyMd: "flex-start",
  justifySplit: "flex-start",
  columns: "none",
  columnsSm: "none",
  columnsMd: "none",
  columnsSplit: "none",
  paddingBlock: "0px",
  paddingBlockSm: "0px",
  paddingBlockMd: "0px",
  paddingBlockSplit: "0px",
  paddingInline: "0px",
  paddingInlineSm: "0px",
  paddingInlineMd: "0px",
  paddingInlineSplit: "0px",
});
