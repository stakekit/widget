import { createVar, keyframes, style } from "@vanilla-extract/css";
import { atoms } from "../../styles";

export const tokenLogo = style({
  borderRadius: "50%",
});

export const breakWord = style({ wordBreak: "break-all" });

export const modalItemNameContainer = style([
  atoms({ marginRight: "2" }),
  breakWord,
  {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
]);

export const defaultColor = createVar();

export const defaultColorContainer = style([
  atoms({ borderRadius: "half" }),
  { background: defaultColor },
]);

export const validatorSelectContainer = style([
  defaultColorContainer,
  atoms({ marginRight: "2" }),
]);

const fadeInAnimation = keyframes({
  from: {
    opacity: "0",
    transform: "translate(-20px, 0)",
  },
  to: {
    opacity: "1",
    transform: "translate(0px, 0px)",
  },
});

const fadeOutAnimation = keyframes({
  from: {
    opacity: "1",
    transform: "translate(0px, 0px)",
  },
  to: {
    transform: "translate(-20px, 0)",
    opacity: "0",
  },
});

export const fadeIn = style({
  animationDuration: "0.15s",
  animationName: fadeInAnimation,
  animationFillMode: "forwards",
});

export const fadeOut = style({
  animationDuration: "0.15s",
  animationName: fadeOutAnimation,
  animationFillMode: "forwards",
});

export const virtuosoContainer = style({
  height: "auto",
  width: "100%",
  scrollbarWidth: "none",
  "::-webkit-scrollbar": {
    display: "none",
  },
});

export const listContainer = style({
  width: "100%",
  height: "500px",
});

export const claimRewardsContainer = style([
  atoms({
    background: "positionsClaimRewardsBackground",
    borderRadius: "base",
  }),
  {
    padding: "2px 6px",
  },
]);

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  width: "100%",
});
