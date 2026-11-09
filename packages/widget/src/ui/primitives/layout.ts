import * as stylex from "@stylexjs/stylex";
import type { AriaAttributes, AriaRole, ReactNode } from "react";
import type { HostHook } from "../host-hook";
import { containerBand } from "../tokens/container.stylex";
import { gutter } from "../tokens/presentation.stylex";
import { gridTrack } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { layoutVars as v } from "./layout.stylex";

// For each responsive prop, one map per container size. A size's map sets its
// own variable and every larger one, so a value applies from its size up; each
// prop's resolver below applies the maps smallest first.

const METRICS = `repeat(auto-fit, minmax(min(${gridTrack.metricMin}, 100%), 1fr))`;
const SPLIT = `minmax(0, ${gridTrack.splitAside}) minmax(0, 1fr)`;
// A centre cell at its content's width between two equal flanks, so the
// centre stays centred whatever each flank holds. Where the row is too
// narrow for that, each flank keeps its content's width and the centre
// gives up space first, so it never covers a flank's control.
const FLANKED =
  "minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr)";

const directionBase = stylex.create({
  row: {
    [v.direction]: "row",
    [v.directionSm]: "row",
    [v.directionMd]: "row",
    [v.directionSplit]: "row",
  },
  column: {
    [v.direction]: "column",
    [v.directionSm]: "column",
    [v.directionMd]: "column",
    [v.directionSplit]: "column",
  },
  rowReverse: {
    [v.direction]: "row-reverse",
    [v.directionSm]: "row-reverse",
    [v.directionMd]: "row-reverse",
    [v.directionSplit]: "row-reverse",
  },
  columnReverse: {
    [v.direction]: "column-reverse",
    [v.directionSm]: "column-reverse",
    [v.directionMd]: "column-reverse",
    [v.directionSplit]: "column-reverse",
  },
});
const directionSm = stylex.create({
  row: {
    [v.directionSm]: "row",
    [v.directionMd]: "row",
    [v.directionSplit]: "row",
  },
  column: {
    [v.directionSm]: "column",
    [v.directionMd]: "column",
    [v.directionSplit]: "column",
  },
  rowReverse: {
    [v.directionSm]: "row-reverse",
    [v.directionMd]: "row-reverse",
    [v.directionSplit]: "row-reverse",
  },
  columnReverse: {
    [v.directionSm]: "column-reverse",
    [v.directionMd]: "column-reverse",
    [v.directionSplit]: "column-reverse",
  },
});
const directionMd = stylex.create({
  row: { [v.directionMd]: "row", [v.directionSplit]: "row" },
  column: { [v.directionMd]: "column", [v.directionSplit]: "column" },
  rowReverse: {
    [v.directionMd]: "row-reverse",
    [v.directionSplit]: "row-reverse",
  },
  columnReverse: {
    [v.directionMd]: "column-reverse",
    [v.directionSplit]: "column-reverse",
  },
});
const directionSplit = stylex.create({
  row: { [v.directionSplit]: "row" },
  column: { [v.directionSplit]: "column" },
  rowReverse: { [v.directionSplit]: "row-reverse" },
  columnReverse: { [v.directionSplit]: "column-reverse" },
});

const gapBase = stylex.create({
  0: {
    [v.gap]: space[0],
    [v.gapSm]: space[0],
    [v.gapMd]: space[0],
    [v.gapSplit]: space[0],
  },
  2: {
    [v.gap]: space[2],
    [v.gapSm]: space[2],
    [v.gapMd]: space[2],
    [v.gapSplit]: space[2],
  },
  4: {
    [v.gap]: space[4],
    [v.gapSm]: space[4],
    [v.gapMd]: space[4],
    [v.gapSplit]: space[4],
  },
  6: {
    [v.gap]: space[6],
    [v.gapSm]: space[6],
    [v.gapMd]: space[6],
    [v.gapSplit]: space[6],
  },
  8: {
    [v.gap]: space[8],
    [v.gapSm]: space[8],
    [v.gapMd]: space[8],
    [v.gapSplit]: space[8],
  },
  12: {
    [v.gap]: space[12],
    [v.gapSm]: space[12],
    [v.gapMd]: space[12],
    [v.gapSplit]: space[12],
  },
  16: {
    [v.gap]: space[16],
    [v.gapSm]: space[16],
    [v.gapMd]: space[16],
    [v.gapSplit]: space[16],
  },
  20: {
    [v.gap]: space[20],
    [v.gapSm]: space[20],
    [v.gapMd]: space[20],
    [v.gapSplit]: space[20],
  },
  24: {
    [v.gap]: space[24],
    [v.gapSm]: space[24],
    [v.gapMd]: space[24],
    [v.gapSplit]: space[24],
  },
  32: {
    [v.gap]: space[32],
    [v.gapSm]: space[32],
    [v.gapMd]: space[32],
    [v.gapSplit]: space[32],
  },
  40: {
    [v.gap]: space[40],
    [v.gapSm]: space[40],
    [v.gapMd]: space[40],
    [v.gapSplit]: space[40],
  },
  48: {
    [v.gap]: space[48],
    [v.gapSm]: space[48],
    [v.gapMd]: space[48],
    [v.gapSplit]: space[48],
  },
  64: {
    [v.gap]: space[64],
    [v.gapSm]: space[64],
    [v.gapMd]: space[64],
    [v.gapSplit]: space[64],
  },
  section: {
    [v.gap]: space.section,
    [v.gapSm]: space.section,
    [v.gapMd]: space.section,
    [v.gapSplit]: space.section,
  },
  gutter: {
    [v.gap]: gutter.size,
    [v.gapSm]: gutter.size,
    [v.gapMd]: gutter.size,
    [v.gapSplit]: gutter.size,
  },
});
const gapSm = stylex.create({
  0: { [v.gapSm]: space[0], [v.gapMd]: space[0], [v.gapSplit]: space[0] },
  2: { [v.gapSm]: space[2], [v.gapMd]: space[2], [v.gapSplit]: space[2] },
  4: { [v.gapSm]: space[4], [v.gapMd]: space[4], [v.gapSplit]: space[4] },
  6: { [v.gapSm]: space[6], [v.gapMd]: space[6], [v.gapSplit]: space[6] },
  8: { [v.gapSm]: space[8], [v.gapMd]: space[8], [v.gapSplit]: space[8] },
  12: { [v.gapSm]: space[12], [v.gapMd]: space[12], [v.gapSplit]: space[12] },
  16: { [v.gapSm]: space[16], [v.gapMd]: space[16], [v.gapSplit]: space[16] },
  20: { [v.gapSm]: space[20], [v.gapMd]: space[20], [v.gapSplit]: space[20] },
  24: { [v.gapSm]: space[24], [v.gapMd]: space[24], [v.gapSplit]: space[24] },
  32: { [v.gapSm]: space[32], [v.gapMd]: space[32], [v.gapSplit]: space[32] },
  40: { [v.gapSm]: space[40], [v.gapMd]: space[40], [v.gapSplit]: space[40] },
  48: { [v.gapSm]: space[48], [v.gapMd]: space[48], [v.gapSplit]: space[48] },
  64: { [v.gapSm]: space[64], [v.gapMd]: space[64], [v.gapSplit]: space[64] },
  section: {
    [v.gapSm]: space.section,
    [v.gapMd]: space.section,
    [v.gapSplit]: space.section,
  },
  gutter: {
    [v.gapSm]: gutter.size,
    [v.gapMd]: gutter.size,
    [v.gapSplit]: gutter.size,
  },
});
const gapMd = stylex.create({
  0: { [v.gapMd]: space[0], [v.gapSplit]: space[0] },
  2: { [v.gapMd]: space[2], [v.gapSplit]: space[2] },
  4: { [v.gapMd]: space[4], [v.gapSplit]: space[4] },
  6: { [v.gapMd]: space[6], [v.gapSplit]: space[6] },
  8: { [v.gapMd]: space[8], [v.gapSplit]: space[8] },
  12: { [v.gapMd]: space[12], [v.gapSplit]: space[12] },
  16: { [v.gapMd]: space[16], [v.gapSplit]: space[16] },
  20: { [v.gapMd]: space[20], [v.gapSplit]: space[20] },
  24: { [v.gapMd]: space[24], [v.gapSplit]: space[24] },
  32: { [v.gapMd]: space[32], [v.gapSplit]: space[32] },
  40: { [v.gapMd]: space[40], [v.gapSplit]: space[40] },
  48: { [v.gapMd]: space[48], [v.gapSplit]: space[48] },
  64: { [v.gapMd]: space[64], [v.gapSplit]: space[64] },
  section: { [v.gapMd]: space.section, [v.gapSplit]: space.section },
  gutter: { [v.gapMd]: gutter.size, [v.gapSplit]: gutter.size },
});
const gapSplit = stylex.create({
  0: { [v.gapSplit]: space[0] },
  2: { [v.gapSplit]: space[2] },
  4: { [v.gapSplit]: space[4] },
  6: { [v.gapSplit]: space[6] },
  8: { [v.gapSplit]: space[8] },
  12: { [v.gapSplit]: space[12] },
  16: { [v.gapSplit]: space[16] },
  20: { [v.gapSplit]: space[20] },
  24: { [v.gapSplit]: space[24] },
  32: { [v.gapSplit]: space[32] },
  40: { [v.gapSplit]: space[40] },
  48: { [v.gapSplit]: space[48] },
  64: { [v.gapSplit]: space[64] },
  section: { [v.gapSplit]: space.section },
  gutter: { [v.gapSplit]: gutter.size },
});

const alignBase = stylex.create({
  start: {
    [v.align]: "flex-start",
    [v.alignSm]: "flex-start",
    [v.alignMd]: "flex-start",
    [v.alignSplit]: "flex-start",
  },
  center: {
    [v.align]: "center",
    [v.alignSm]: "center",
    [v.alignMd]: "center",
    [v.alignSplit]: "center",
  },
  end: {
    [v.align]: "flex-end",
    [v.alignSm]: "flex-end",
    [v.alignMd]: "flex-end",
    [v.alignSplit]: "flex-end",
  },
  stretch: {
    [v.align]: "stretch",
    [v.alignSm]: "stretch",
    [v.alignMd]: "stretch",
    [v.alignSplit]: "stretch",
  },
  baseline: {
    [v.align]: "baseline",
    [v.alignSm]: "baseline",
    [v.alignMd]: "baseline",
    [v.alignSplit]: "baseline",
  },
});
const alignSm = stylex.create({
  start: {
    [v.alignSm]: "flex-start",
    [v.alignMd]: "flex-start",
    [v.alignSplit]: "flex-start",
  },
  center: {
    [v.alignSm]: "center",
    [v.alignMd]: "center",
    [v.alignSplit]: "center",
  },
  end: {
    [v.alignSm]: "flex-end",
    [v.alignMd]: "flex-end",
    [v.alignSplit]: "flex-end",
  },
  stretch: {
    [v.alignSm]: "stretch",
    [v.alignMd]: "stretch",
    [v.alignSplit]: "stretch",
  },
  baseline: {
    [v.alignSm]: "baseline",
    [v.alignMd]: "baseline",
    [v.alignSplit]: "baseline",
  },
});
const alignMd = stylex.create({
  start: { [v.alignMd]: "flex-start", [v.alignSplit]: "flex-start" },
  center: { [v.alignMd]: "center", [v.alignSplit]: "center" },
  end: { [v.alignMd]: "flex-end", [v.alignSplit]: "flex-end" },
  stretch: { [v.alignMd]: "stretch", [v.alignSplit]: "stretch" },
  baseline: { [v.alignMd]: "baseline", [v.alignSplit]: "baseline" },
});
const alignSplit = stylex.create({
  start: { [v.alignSplit]: "flex-start" },
  center: { [v.alignSplit]: "center" },
  end: { [v.alignSplit]: "flex-end" },
  stretch: { [v.alignSplit]: "stretch" },
  baseline: { [v.alignSplit]: "baseline" },
});

const justifyBase = stylex.create({
  start: {
    [v.justify]: "flex-start",
    [v.justifySm]: "flex-start",
    [v.justifyMd]: "flex-start",
    [v.justifySplit]: "flex-start",
  },
  center: {
    [v.justify]: "center",
    [v.justifySm]: "center",
    [v.justifyMd]: "center",
    [v.justifySplit]: "center",
  },
  end: {
    [v.justify]: "flex-end",
    [v.justifySm]: "flex-end",
    [v.justifyMd]: "flex-end",
    [v.justifySplit]: "flex-end",
  },
  between: {
    [v.justify]: "space-between",
    [v.justifySm]: "space-between",
    [v.justifyMd]: "space-between",
    [v.justifySplit]: "space-between",
  },
});
const justifySm = stylex.create({
  start: {
    [v.justifySm]: "flex-start",
    [v.justifyMd]: "flex-start",
    [v.justifySplit]: "flex-start",
  },
  center: {
    [v.justifySm]: "center",
    [v.justifyMd]: "center",
    [v.justifySplit]: "center",
  },
  end: {
    [v.justifySm]: "flex-end",
    [v.justifyMd]: "flex-end",
    [v.justifySplit]: "flex-end",
  },
  between: {
    [v.justifySm]: "space-between",
    [v.justifyMd]: "space-between",
    [v.justifySplit]: "space-between",
  },
});
const justifyMd = stylex.create({
  start: { [v.justifyMd]: "flex-start", [v.justifySplit]: "flex-start" },
  center: { [v.justifyMd]: "center", [v.justifySplit]: "center" },
  end: { [v.justifyMd]: "flex-end", [v.justifySplit]: "flex-end" },
  between: {
    [v.justifyMd]: "space-between",
    [v.justifySplit]: "space-between",
  },
});
const justifySplit = stylex.create({
  start: { [v.justifySplit]: "flex-start" },
  center: { [v.justifySplit]: "center" },
  end: { [v.justifySplit]: "flex-end" },
  between: { [v.justifySplit]: "space-between" },
});

const columnsBase = stylex.create({
  1: {
    [v.columns]: "minmax(0, 1fr)",
    [v.columnsSm]: "minmax(0, 1fr)",
    [v.columnsMd]: "minmax(0, 1fr)",
    [v.columnsSplit]: "minmax(0, 1fr)",
  },
  2: {
    [v.columns]: "repeat(2, minmax(0, 1fr))",
    [v.columnsSm]: "repeat(2, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(2, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(2, minmax(0, 1fr))",
  },
  3: {
    [v.columns]: "repeat(3, minmax(0, 1fr))",
    [v.columnsSm]: "repeat(3, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(3, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(3, minmax(0, 1fr))",
  },
  4: {
    [v.columns]: "repeat(4, minmax(0, 1fr))",
    [v.columnsSm]: "repeat(4, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(4, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(4, minmax(0, 1fr))",
  },
  metrics: {
    [v.columns]: METRICS,
    [v.columnsSm]: METRICS,
    [v.columnsMd]: METRICS,
    [v.columnsSplit]: METRICS,
  },
  split: {
    [v.columns]: SPLIT,
    [v.columnsSm]: SPLIT,
    [v.columnsMd]: SPLIT,
    [v.columnsSplit]: SPLIT,
  },
  flanked: {
    [v.columns]: FLANKED,
    [v.columnsSm]: FLANKED,
    [v.columnsMd]: FLANKED,
    [v.columnsSplit]: FLANKED,
  },
});
const columnsSm = stylex.create({
  1: {
    [v.columnsSm]: "minmax(0, 1fr)",
    [v.columnsMd]: "minmax(0, 1fr)",
    [v.columnsSplit]: "minmax(0, 1fr)",
  },
  2: {
    [v.columnsSm]: "repeat(2, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(2, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(2, minmax(0, 1fr))",
  },
  3: {
    [v.columnsSm]: "repeat(3, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(3, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(3, minmax(0, 1fr))",
  },
  4: {
    [v.columnsSm]: "repeat(4, minmax(0, 1fr))",
    [v.columnsMd]: "repeat(4, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(4, minmax(0, 1fr))",
  },
  metrics: {
    [v.columnsSm]: METRICS,
    [v.columnsMd]: METRICS,
    [v.columnsSplit]: METRICS,
  },
  split: {
    [v.columnsSm]: SPLIT,
    [v.columnsMd]: SPLIT,
    [v.columnsSplit]: SPLIT,
  },
  flanked: {
    [v.columnsSm]: FLANKED,
    [v.columnsMd]: FLANKED,
    [v.columnsSplit]: FLANKED,
  },
});
const columnsMd = stylex.create({
  1: { [v.columnsMd]: "minmax(0, 1fr)", [v.columnsSplit]: "minmax(0, 1fr)" },
  2: {
    [v.columnsMd]: "repeat(2, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(2, minmax(0, 1fr))",
  },
  3: {
    [v.columnsMd]: "repeat(3, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(3, minmax(0, 1fr))",
  },
  4: {
    [v.columnsMd]: "repeat(4, minmax(0, 1fr))",
    [v.columnsSplit]: "repeat(4, minmax(0, 1fr))",
  },
  metrics: { [v.columnsMd]: METRICS, [v.columnsSplit]: METRICS },
  split: { [v.columnsMd]: SPLIT, [v.columnsSplit]: SPLIT },
  flanked: { [v.columnsMd]: FLANKED, [v.columnsSplit]: FLANKED },
});
const columnsSplit = stylex.create({
  1: { [v.columnsSplit]: "minmax(0, 1fr)" },
  2: { [v.columnsSplit]: "repeat(2, minmax(0, 1fr))" },
  3: { [v.columnsSplit]: "repeat(3, minmax(0, 1fr))" },
  4: { [v.columnsSplit]: "repeat(4, minmax(0, 1fr))" },
  metrics: { [v.columnsSplit]: METRICS },
  split: { [v.columnsSplit]: SPLIT },
  flanked: { [v.columnsSplit]: FLANKED },
});

const paddingBlockBase = stylex.create({
  0: {
    [v.paddingBlock]: space[0],
    [v.paddingBlockSm]: space[0],
    [v.paddingBlockMd]: space[0],
    [v.paddingBlockSplit]: space[0],
  },
  2: {
    [v.paddingBlock]: space[2],
    [v.paddingBlockSm]: space[2],
    [v.paddingBlockMd]: space[2],
    [v.paddingBlockSplit]: space[2],
  },
  4: {
    [v.paddingBlock]: space[4],
    [v.paddingBlockSm]: space[4],
    [v.paddingBlockMd]: space[4],
    [v.paddingBlockSplit]: space[4],
  },
  6: {
    [v.paddingBlock]: space[6],
    [v.paddingBlockSm]: space[6],
    [v.paddingBlockMd]: space[6],
    [v.paddingBlockSplit]: space[6],
  },
  8: {
    [v.paddingBlock]: space[8],
    [v.paddingBlockSm]: space[8],
    [v.paddingBlockMd]: space[8],
    [v.paddingBlockSplit]: space[8],
  },
  12: {
    [v.paddingBlock]: space[12],
    [v.paddingBlockSm]: space[12],
    [v.paddingBlockMd]: space[12],
    [v.paddingBlockSplit]: space[12],
  },
  16: {
    [v.paddingBlock]: space[16],
    [v.paddingBlockSm]: space[16],
    [v.paddingBlockMd]: space[16],
    [v.paddingBlockSplit]: space[16],
  },
  20: {
    [v.paddingBlock]: space[20],
    [v.paddingBlockSm]: space[20],
    [v.paddingBlockMd]: space[20],
    [v.paddingBlockSplit]: space[20],
  },
  24: {
    [v.paddingBlock]: space[24],
    [v.paddingBlockSm]: space[24],
    [v.paddingBlockMd]: space[24],
    [v.paddingBlockSplit]: space[24],
  },
  32: {
    [v.paddingBlock]: space[32],
    [v.paddingBlockSm]: space[32],
    [v.paddingBlockMd]: space[32],
    [v.paddingBlockSplit]: space[32],
  },
  40: {
    [v.paddingBlock]: space[40],
    [v.paddingBlockSm]: space[40],
    [v.paddingBlockMd]: space[40],
    [v.paddingBlockSplit]: space[40],
  },
  48: {
    [v.paddingBlock]: space[48],
    [v.paddingBlockSm]: space[48],
    [v.paddingBlockMd]: space[48],
    [v.paddingBlockSplit]: space[48],
  },
  64: {
    [v.paddingBlock]: space[64],
    [v.paddingBlockSm]: space[64],
    [v.paddingBlockMd]: space[64],
    [v.paddingBlockSplit]: space[64],
  },
  section: {
    [v.paddingBlock]: space.section,
    [v.paddingBlockSm]: space.section,
    [v.paddingBlockMd]: space.section,
    [v.paddingBlockSplit]: space.section,
  },
  gutter: {
    [v.paddingBlock]: gutter.size,
    [v.paddingBlockSm]: gutter.size,
    [v.paddingBlockMd]: gutter.size,
    [v.paddingBlockSplit]: gutter.size,
  },
});
const paddingBlockSm = stylex.create({
  0: {
    [v.paddingBlockSm]: space[0],
    [v.paddingBlockMd]: space[0],
    [v.paddingBlockSplit]: space[0],
  },
  2: {
    [v.paddingBlockSm]: space[2],
    [v.paddingBlockMd]: space[2],
    [v.paddingBlockSplit]: space[2],
  },
  4: {
    [v.paddingBlockSm]: space[4],
    [v.paddingBlockMd]: space[4],
    [v.paddingBlockSplit]: space[4],
  },
  6: {
    [v.paddingBlockSm]: space[6],
    [v.paddingBlockMd]: space[6],
    [v.paddingBlockSplit]: space[6],
  },
  8: {
    [v.paddingBlockSm]: space[8],
    [v.paddingBlockMd]: space[8],
    [v.paddingBlockSplit]: space[8],
  },
  12: {
    [v.paddingBlockSm]: space[12],
    [v.paddingBlockMd]: space[12],
    [v.paddingBlockSplit]: space[12],
  },
  16: {
    [v.paddingBlockSm]: space[16],
    [v.paddingBlockMd]: space[16],
    [v.paddingBlockSplit]: space[16],
  },
  20: {
    [v.paddingBlockSm]: space[20],
    [v.paddingBlockMd]: space[20],
    [v.paddingBlockSplit]: space[20],
  },
  24: {
    [v.paddingBlockSm]: space[24],
    [v.paddingBlockMd]: space[24],
    [v.paddingBlockSplit]: space[24],
  },
  32: {
    [v.paddingBlockSm]: space[32],
    [v.paddingBlockMd]: space[32],
    [v.paddingBlockSplit]: space[32],
  },
  40: {
    [v.paddingBlockSm]: space[40],
    [v.paddingBlockMd]: space[40],
    [v.paddingBlockSplit]: space[40],
  },
  48: {
    [v.paddingBlockSm]: space[48],
    [v.paddingBlockMd]: space[48],
    [v.paddingBlockSplit]: space[48],
  },
  64: {
    [v.paddingBlockSm]: space[64],
    [v.paddingBlockMd]: space[64],
    [v.paddingBlockSplit]: space[64],
  },
  section: {
    [v.paddingBlockSm]: space.section,
    [v.paddingBlockMd]: space.section,
    [v.paddingBlockSplit]: space.section,
  },
  gutter: {
    [v.paddingBlockSm]: gutter.size,
    [v.paddingBlockMd]: gutter.size,
    [v.paddingBlockSplit]: gutter.size,
  },
});
const paddingBlockMd = stylex.create({
  0: { [v.paddingBlockMd]: space[0], [v.paddingBlockSplit]: space[0] },
  2: { [v.paddingBlockMd]: space[2], [v.paddingBlockSplit]: space[2] },
  4: { [v.paddingBlockMd]: space[4], [v.paddingBlockSplit]: space[4] },
  6: { [v.paddingBlockMd]: space[6], [v.paddingBlockSplit]: space[6] },
  8: { [v.paddingBlockMd]: space[8], [v.paddingBlockSplit]: space[8] },
  12: { [v.paddingBlockMd]: space[12], [v.paddingBlockSplit]: space[12] },
  16: { [v.paddingBlockMd]: space[16], [v.paddingBlockSplit]: space[16] },
  20: { [v.paddingBlockMd]: space[20], [v.paddingBlockSplit]: space[20] },
  24: { [v.paddingBlockMd]: space[24], [v.paddingBlockSplit]: space[24] },
  32: { [v.paddingBlockMd]: space[32], [v.paddingBlockSplit]: space[32] },
  40: { [v.paddingBlockMd]: space[40], [v.paddingBlockSplit]: space[40] },
  48: { [v.paddingBlockMd]: space[48], [v.paddingBlockSplit]: space[48] },
  64: { [v.paddingBlockMd]: space[64], [v.paddingBlockSplit]: space[64] },
  section: {
    [v.paddingBlockMd]: space.section,
    [v.paddingBlockSplit]: space.section,
  },
  gutter: {
    [v.paddingBlockMd]: gutter.size,
    [v.paddingBlockSplit]: gutter.size,
  },
});
const paddingBlockSplit = stylex.create({
  0: { [v.paddingBlockSplit]: space[0] },
  2: { [v.paddingBlockSplit]: space[2] },
  4: { [v.paddingBlockSplit]: space[4] },
  6: { [v.paddingBlockSplit]: space[6] },
  8: { [v.paddingBlockSplit]: space[8] },
  12: { [v.paddingBlockSplit]: space[12] },
  16: { [v.paddingBlockSplit]: space[16] },
  20: { [v.paddingBlockSplit]: space[20] },
  24: { [v.paddingBlockSplit]: space[24] },
  32: { [v.paddingBlockSplit]: space[32] },
  40: { [v.paddingBlockSplit]: space[40] },
  48: { [v.paddingBlockSplit]: space[48] },
  64: { [v.paddingBlockSplit]: space[64] },
  section: { [v.paddingBlockSplit]: space.section },
  gutter: { [v.paddingBlockSplit]: gutter.size },
});

const paddingInlineBase = stylex.create({
  0: {
    [v.paddingInline]: space[0],
    [v.paddingInlineSm]: space[0],
    [v.paddingInlineMd]: space[0],
    [v.paddingInlineSplit]: space[0],
  },
  2: {
    [v.paddingInline]: space[2],
    [v.paddingInlineSm]: space[2],
    [v.paddingInlineMd]: space[2],
    [v.paddingInlineSplit]: space[2],
  },
  4: {
    [v.paddingInline]: space[4],
    [v.paddingInlineSm]: space[4],
    [v.paddingInlineMd]: space[4],
    [v.paddingInlineSplit]: space[4],
  },
  6: {
    [v.paddingInline]: space[6],
    [v.paddingInlineSm]: space[6],
    [v.paddingInlineMd]: space[6],
    [v.paddingInlineSplit]: space[6],
  },
  8: {
    [v.paddingInline]: space[8],
    [v.paddingInlineSm]: space[8],
    [v.paddingInlineMd]: space[8],
    [v.paddingInlineSplit]: space[8],
  },
  12: {
    [v.paddingInline]: space[12],
    [v.paddingInlineSm]: space[12],
    [v.paddingInlineMd]: space[12],
    [v.paddingInlineSplit]: space[12],
  },
  16: {
    [v.paddingInline]: space[16],
    [v.paddingInlineSm]: space[16],
    [v.paddingInlineMd]: space[16],
    [v.paddingInlineSplit]: space[16],
  },
  20: {
    [v.paddingInline]: space[20],
    [v.paddingInlineSm]: space[20],
    [v.paddingInlineMd]: space[20],
    [v.paddingInlineSplit]: space[20],
  },
  24: {
    [v.paddingInline]: space[24],
    [v.paddingInlineSm]: space[24],
    [v.paddingInlineMd]: space[24],
    [v.paddingInlineSplit]: space[24],
  },
  32: {
    [v.paddingInline]: space[32],
    [v.paddingInlineSm]: space[32],
    [v.paddingInlineMd]: space[32],
    [v.paddingInlineSplit]: space[32],
  },
  40: {
    [v.paddingInline]: space[40],
    [v.paddingInlineSm]: space[40],
    [v.paddingInlineMd]: space[40],
    [v.paddingInlineSplit]: space[40],
  },
  48: {
    [v.paddingInline]: space[48],
    [v.paddingInlineSm]: space[48],
    [v.paddingInlineMd]: space[48],
    [v.paddingInlineSplit]: space[48],
  },
  64: {
    [v.paddingInline]: space[64],
    [v.paddingInlineSm]: space[64],
    [v.paddingInlineMd]: space[64],
    [v.paddingInlineSplit]: space[64],
  },
  section: {
    [v.paddingInline]: space.section,
    [v.paddingInlineSm]: space.section,
    [v.paddingInlineMd]: space.section,
    [v.paddingInlineSplit]: space.section,
  },
  gutter: {
    [v.paddingInline]: gutter.size,
    [v.paddingInlineSm]: gutter.size,
    [v.paddingInlineMd]: gutter.size,
    [v.paddingInlineSplit]: gutter.size,
  },
});
const paddingInlineSm = stylex.create({
  0: {
    [v.paddingInlineSm]: space[0],
    [v.paddingInlineMd]: space[0],
    [v.paddingInlineSplit]: space[0],
  },
  2: {
    [v.paddingInlineSm]: space[2],
    [v.paddingInlineMd]: space[2],
    [v.paddingInlineSplit]: space[2],
  },
  4: {
    [v.paddingInlineSm]: space[4],
    [v.paddingInlineMd]: space[4],
    [v.paddingInlineSplit]: space[4],
  },
  6: {
    [v.paddingInlineSm]: space[6],
    [v.paddingInlineMd]: space[6],
    [v.paddingInlineSplit]: space[6],
  },
  8: {
    [v.paddingInlineSm]: space[8],
    [v.paddingInlineMd]: space[8],
    [v.paddingInlineSplit]: space[8],
  },
  12: {
    [v.paddingInlineSm]: space[12],
    [v.paddingInlineMd]: space[12],
    [v.paddingInlineSplit]: space[12],
  },
  16: {
    [v.paddingInlineSm]: space[16],
    [v.paddingInlineMd]: space[16],
    [v.paddingInlineSplit]: space[16],
  },
  20: {
    [v.paddingInlineSm]: space[20],
    [v.paddingInlineMd]: space[20],
    [v.paddingInlineSplit]: space[20],
  },
  24: {
    [v.paddingInlineSm]: space[24],
    [v.paddingInlineMd]: space[24],
    [v.paddingInlineSplit]: space[24],
  },
  32: {
    [v.paddingInlineSm]: space[32],
    [v.paddingInlineMd]: space[32],
    [v.paddingInlineSplit]: space[32],
  },
  40: {
    [v.paddingInlineSm]: space[40],
    [v.paddingInlineMd]: space[40],
    [v.paddingInlineSplit]: space[40],
  },
  48: {
    [v.paddingInlineSm]: space[48],
    [v.paddingInlineMd]: space[48],
    [v.paddingInlineSplit]: space[48],
  },
  64: {
    [v.paddingInlineSm]: space[64],
    [v.paddingInlineMd]: space[64],
    [v.paddingInlineSplit]: space[64],
  },
  section: {
    [v.paddingInlineSm]: space.section,
    [v.paddingInlineMd]: space.section,
    [v.paddingInlineSplit]: space.section,
  },
  gutter: {
    [v.paddingInlineSm]: gutter.size,
    [v.paddingInlineMd]: gutter.size,
    [v.paddingInlineSplit]: gutter.size,
  },
});
const paddingInlineMd = stylex.create({
  0: { [v.paddingInlineMd]: space[0], [v.paddingInlineSplit]: space[0] },
  2: { [v.paddingInlineMd]: space[2], [v.paddingInlineSplit]: space[2] },
  4: { [v.paddingInlineMd]: space[4], [v.paddingInlineSplit]: space[4] },
  6: { [v.paddingInlineMd]: space[6], [v.paddingInlineSplit]: space[6] },
  8: { [v.paddingInlineMd]: space[8], [v.paddingInlineSplit]: space[8] },
  12: { [v.paddingInlineMd]: space[12], [v.paddingInlineSplit]: space[12] },
  16: { [v.paddingInlineMd]: space[16], [v.paddingInlineSplit]: space[16] },
  20: { [v.paddingInlineMd]: space[20], [v.paddingInlineSplit]: space[20] },
  24: { [v.paddingInlineMd]: space[24], [v.paddingInlineSplit]: space[24] },
  32: { [v.paddingInlineMd]: space[32], [v.paddingInlineSplit]: space[32] },
  40: { [v.paddingInlineMd]: space[40], [v.paddingInlineSplit]: space[40] },
  48: { [v.paddingInlineMd]: space[48], [v.paddingInlineSplit]: space[48] },
  64: { [v.paddingInlineMd]: space[64], [v.paddingInlineSplit]: space[64] },
  section: {
    [v.paddingInlineMd]: space.section,
    [v.paddingInlineSplit]: space.section,
  },
  gutter: {
    [v.paddingInlineMd]: gutter.size,
    [v.paddingInlineSplit]: gutter.size,
  },
});
const paddingInlineSplit = stylex.create({
  0: { [v.paddingInlineSplit]: space[0] },
  2: { [v.paddingInlineSplit]: space[2] },
  4: { [v.paddingInlineSplit]: space[4] },
  6: { [v.paddingInlineSplit]: space[6] },
  8: { [v.paddingInlineSplit]: space[8] },
  12: { [v.paddingInlineSplit]: space[12] },
  16: { [v.paddingInlineSplit]: space[16] },
  20: { [v.paddingInlineSplit]: space[20] },
  24: { [v.paddingInlineSplit]: space[24] },
  32: { [v.paddingInlineSplit]: space[32] },
  40: { [v.paddingInlineSplit]: space[40] },
  48: { [v.paddingInlineSplit]: space[48] },
  64: { [v.paddingInlineSplit]: space[64] },
  section: { [v.paddingInlineSplit]: space.section },
  gutter: { [v.paddingInlineSplit]: gutter.size },
});

/** Reads the responsive variables at each container size. */
export const layoutStyles = stylex.create({
  direction: {
    flexDirection: {
      default: v.direction,
      [containerBand.sm]: v.directionSm,
      [containerBand.md]: v.directionMd,
      [containerBand.split]: v.directionSplit,
    },
  },
  gap: {
    gap: {
      default: v.gap,
      [containerBand.sm]: v.gapSm,
      [containerBand.md]: v.gapMd,
      [containerBand.split]: v.gapSplit,
    },
  },
  align: {
    alignItems: {
      default: v.align,
      [containerBand.sm]: v.alignSm,
      [containerBand.md]: v.alignMd,
      [containerBand.split]: v.alignSplit,
    },
  },
  justify: {
    justifyContent: {
      default: v.justify,
      [containerBand.sm]: v.justifySm,
      [containerBand.md]: v.justifyMd,
      [containerBand.split]: v.justifySplit,
    },
  },
  columns: {
    gridTemplateColumns: {
      default: v.columns,
      [containerBand.sm]: v.columnsSm,
      [containerBand.md]: v.columnsMd,
      [containerBand.split]: v.columnsSplit,
    },
  },
  paddingBlock: {
    paddingBlock: {
      default: v.paddingBlock,
      [containerBand.sm]: v.paddingBlockSm,
      [containerBand.md]: v.paddingBlockMd,
      [containerBand.split]: v.paddingBlockSplit,
    },
  },
  paddingInline: {
    paddingInline: {
      default: v.paddingInline,
      [containerBand.sm]: v.paddingInlineSm,
      [containerBand.md]: v.paddingInlineMd,
      [containerBand.split]: v.paddingInlineSplit,
    },
  },
});

/** A flex direction a `Stack` can take. */
export type Direction = keyof typeof directionBase;

/** A step on the spacing scale, or the named `section` and `gutter` insets. */
export type Space = keyof typeof gapBase;

/** A cross-axis alignment. */
export type Align = keyof typeof alignBase;

/** A main-axis distribution. */
export type Justify = keyof typeof justifyBase;

/** A column count, or the named `metrics`, `split` and `flanked` tracks. */
export type Columns = keyof typeof columnsBase;

/** The container sizes a responsive value can name, smallest first. */
type ContainerSize = "base" | "sm" | "md" | "split";

type BySize<T> = { readonly base: T } & Partial<
  Record<Exclude<ContainerSize, "base">, T>
>;

/**
 * A value that can change with the container's width: `base` applies at
 * every width, and `sm`, `md` and `split` from their size up.
 */
export type Responsive<T> = T | BySize<T>;

const isBySize = <T extends PropertyKey>(
  value: Responsive<T>
): value is BySize<T> => typeof value === "object";

const bySize = <T extends PropertyKey>(value: Responsive<T>): BySize<T> =>
  isBySize(value) ? value : { base: value };

// Each resolver returns the styles that set its prop's variables, smallest
// size first, indexing its maps directly so StyleX sees every style used.

export const directionStyles = (value: Responsive<Direction>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    directionBase[base],
    sm !== undefined && directionSm[sm],
    md !== undefined && directionMd[md],
    split !== undefined && directionSplit[split],
  ];
};

export const gapStyles = (value: Responsive<Space>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    gapBase[base],
    sm !== undefined && gapSm[sm],
    md !== undefined && gapMd[md],
    split !== undefined && gapSplit[split],
  ];
};

export const alignStyles = (value: Responsive<Align>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    alignBase[base],
    sm !== undefined && alignSm[sm],
    md !== undefined && alignMd[md],
    split !== undefined && alignSplit[split],
  ];
};

export const justifyStyles = (value: Responsive<Justify>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    justifyBase[base],
    sm !== undefined && justifySm[sm],
    md !== undefined && justifyMd[md],
    split !== undefined && justifySplit[split],
  ];
};

export const columnsStyles = (value: Responsive<Columns>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    columnsBase[base],
    sm !== undefined && columnsSm[sm],
    md !== undefined && columnsMd[md],
    split !== undefined && columnsSplit[split],
  ];
};

export const paddingBlockStyles = (value: Responsive<Space>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    paddingBlockBase[base],
    sm !== undefined && paddingBlockSm[sm],
    md !== undefined && paddingBlockMd[md],
    split !== undefined && paddingBlockSplit[split],
  ];
};

export const paddingInlineStyles = (value: Responsive<Space>) => {
  const { base, sm, md, split } = bySize(value);
  return [
    paddingInlineBase[base],
    sm !== undefined && paddingInlineSm[sm],
    md !== undefined && paddingInlineMd[md],
    split !== undefined && paddingInlineSplit[split],
  ];
};

/** The elements a layout primitive can render. */
type LayoutElement =
  | "div"
  | "span"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "aside"
  | "nav"
  | "main"
  | "ul"
  | "ol"
  | "li";

/** Props every layout primitive passes through to its element. */
export type LayoutElementProps = {
  readonly as?: LayoutElement;
  readonly id?: string;
  readonly role?: AriaRole;
  readonly children?: ReactNode;
  /** Rendered as `data-testid`, for tests and hosts that locate the element. */
  readonly testId?: string | undefined;
  /** Rendered as `data-rk`, a hook a host's stylesheet or script relies on. */
  readonly hostHook?: HostHook;
} & Pick<
  AriaAttributes,
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-live"
  | "aria-busy"
>;

/** Shared by the layout primitives: `grow` takes the remaining space in a row. */
export const flexItemStyles = stylex.create({
  grow: { flexGrow: 1, minWidth: 0 },
});
