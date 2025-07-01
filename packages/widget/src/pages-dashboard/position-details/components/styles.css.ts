import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const container = style({ minHeight: "400px" });

export const inactiveContainer = style([
  atoms({
    borderRadius: "base",
    background: "positionsActionRequiredBackground",
  }),
  { padding: "2px 6px" },
]);

export const noWrap = style({ whiteSpace: "nowrap" });

export const addressParent = style({});

export const addressHover = style({
  selectors: {
    [`${addressParent}:hover &`]: { color: vars.color.text },
  },
});

export const topHeaderYieldName = style({
  fontSize: "28px",
});
