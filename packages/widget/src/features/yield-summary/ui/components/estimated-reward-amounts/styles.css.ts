import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../../../../shared/styles/theme/contract.css";

export const selectYieldRewardsText = recipe({
  variants: {
    variant: {
      default: {},
      utila: {},
      finery: {
        color: vars.color.text,
      },
      porto: {},
    },
  },
});

const itemGap = vars.space["3"];

/**
 * Every item draws a leading separator and the row is shifted left by one
 * gap, so the separator of whichever item starts a line falls outside the
 * clipped box. Inline, the separator sits between the amounts; once the
 * amounts wrap, each line starts flush-left without a dangling separator.
 */
export const compactAmountsClip = style({
  overflowX: "clip",
  overflowY: "visible",
});

export const compactAmountsRow = style({
  columnGap: 0,
  display: "flex",
  flexWrap: "wrap",
  marginInline: `calc(-1 * ${itemGap})`,
  rowGap: vars.space["2"],
});

export const compactAmount = style({
  alignItems: "center",
  display: "flex",
  gap: vars.space["2"],
  paddingInline: itemGap,
  position: "relative",
  "::before": {
    background: vars.color.tabBorder,
    bottom: 0,
    content: "",
    left: 0,
    position: "absolute",
    // Reaches up through the section gap to meet the horizontal divider above.
    top: "-18px",
    width: "1px",
  },
});
