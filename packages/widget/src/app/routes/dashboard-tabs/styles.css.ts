import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { vars } from "../../../shared/styles/theme/contract.css";

export const divider = style({
  bottom: 0,
  position: "absolute",
  width: "100%",
});

export const tabsGroupDivider = style([
  atoms({ background: "tabBorder", mx: "2" }),
  { height: "24px", width: "1px" },
]);

export const tab = recipe({
  base: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    flex: 1,
    justifyContent: "center",
    userSelect: "none",
  },
  variants: {
    variant: {
      default: { borderRadius: "8px", padding: "8px 16px" },
      utila: { borderRadius: "8px", padding: "8px 16px" },
      porto: { borderRadius: "8px", padding: "8px 16px" },
    },
    state: { active: {} },
  },
  compoundVariants: [
    {
      variants: { state: "active", variant: "default" },
      style: [atoms({ background: "stakeSectionBackground" })],
    },
    {
      variants: { state: "active", variant: "utila" },
      style: [atoms({ background: "stakeSectionBackground" })],
    },
    {
      variants: { state: "active", variant: "porto" },
      style: [atoms({ background: "white" })],
    },
  ],
});

export const tabBorder = style([
  atoms({
    background: "tabBorder",
    borderRadius: "full",
    position: "absolute",
  }),
  { bottom: 0, height: "2.5px", left: 0, right: 0 },
]);

export const tabContainer = recipe({
  base: { display: "flex", flexDirection: "column", position: "relative" },
  variants: {
    variant: {
      default: {},
      utila: {},
      porto: {},
      finery: { height: "80px" },
    },
  },
  defaultVariants: { variant: "default" },
});

export const tabText = recipe({
  base: {
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "125%",
    textAlign: "center",
  },
  variants: {
    state: { selected: {} },
    variant: {
      default: [atoms({ fontWeight: "semibold" }), { fontSize: "14px" }],
      utila: [atoms({ fontWeight: "semibold" }), { fontSize: "14px" }],
      porto: [
        atoms({ color: "textMuted", fontWeight: "semibold" }),
        { fontSize: "14px" },
      ],
    },
  },
  compoundVariants: [
    {
      variants: { state: "selected", variant: "porto" },
      style: { color: vars.color.background },
    },
  ],
  defaultVariants: { variant: "default" },
});

export const tabsContainer = recipe({
  base: [
    atoms({
      alignItems: "center",
      display: "flex",
      justifyContent: "center",
      zIndex: "simple",
    }),
    { gap: "24px" },
  ],
  variants: {
    variant: {
      default: { gap: "4px", padding: "8px 24px" },
      utila: { gap: "4px", padding: "8px 24px" },
      porto: { gap: "4px", padding: "16px 24px" },
    },
  },
  defaultVariants: { variant: "default" },
});

export const tabsWrapper = recipe({
  base: { display: "flex", position: "relative" },
  variants: {
    variant: {
      default: { justifyContent: "flex-start" },
      utila: { justifyContent: "flex-start" },
      porto: { justifyContent: "flex-start" },
    },
  },
  defaultVariants: { variant: "default" },
});
