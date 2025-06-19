import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { vars } from "@sk-widget/styles/theme/contract.css";
import { style } from "@vanilla-extract/css";

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

export const unstakeSignImageStyle = style({
  height: "320px",
  width: "320px",
});

export const unstakeSignContainer = style({
  paddingLeft: "25px",
  paddingRight: "25px",
});

export const priceTxt = style({
  flexGrow: 999,
});
