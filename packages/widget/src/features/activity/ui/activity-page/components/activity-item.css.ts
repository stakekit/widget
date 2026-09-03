import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../../shared/styles/theme/atoms.css";
import {
  activityFeedContainerName,
  widgetContainerName,
} from "../../../../../shared/styles/tokens/containers.css";

export const statusBadge = style([
  atoms({
    background: "positionsActionRequiredBackground",
    borderRadius: "base",
  }),
  { flexShrink: 0, padding: "2px 4px" },
]);

export const completedStatusBadge = style([
  atoms({ borderRadius: "base" }),
  {
    background: "color-mix(in srgb, currentColor 12%, transparent)",
    flexShrink: 0,
    padding: "2px 4px",
  },
]);

export const listItem = style([
  atoms({ gap: "1" }),
  { flexDirection: "column" },
]);

export const iconCircle = style([
  atoms({ background: "background" }),
  {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
]);

export const infoColumn = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "2px",
  minWidth: 0,
});

export const metaRow = style({
  alignItems: "center",
  display: "flex",
  gap: "8px",
  minWidth: 0,
  width: "100%",
});

export const titleText = style([
  atoms({ fontWeight: "medium" }),
  {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
]);

export const viaText = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const hideWhenNarrow = style({
  "@container": {
    [`${activityFeedContainerName} (max-width: 400px)`]: {
      display: "none",
    },
    [`${widgetContainerName} (max-width: 400px)`]: {
      display: "none",
    },
  },
});

export const amountPositive = style([
  hideWhenNarrow,
  atoms({ color: "positionsRewardRate", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);

export const amountNeutral = style([
  hideWhenNarrow,
  atoms({ color: "text", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);

export const timeColumn = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  textAlign: "end",
  flexShrink: 0,
});

export const noWrap = style({ whiteSpace: "nowrap" });
