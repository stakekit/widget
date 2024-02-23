import { keyframes, style } from "@vanilla-extract/css";
import { atoms, vars } from "../../../styles";
import { breakpoints, minMediaQuery } from "../../../styles/tokens/breakpoints";

const slideUp = keyframes({
  "0%": { transform: "translateY(20%)" },
  "100%": { transform: "translateY(0)" },
});

const fadeIn = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

export const container = style({
  zIndex: 2,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "fixed",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});

export const overlay = style([
  {
    animation: `${fadeIn} 150ms ease`,
    willChange: "opacity",
    position: "absolute",
    inset: 0,
    background: vars.color.modalOverlayBackground,
  },
]);

export const content = style([
  {
    "@media": {
      [minMediaQuery("tablet")]: {
        width: "350px",
      },
    },
    animation: `${slideUp} 350ms cubic-bezier(.15,1.15,0.6,1.00), ${fadeIn} 150ms ease`,
    willChange: "transform, opacity",
  },
  atoms({
    width: "full",
    py: "4",
    background: "modalBodyBackground",
  }),
  {
    borderTopLeftRadius: vars.borderRadius.baseContract["2xl"],
    borderTopRightRadius: vars.borderRadius.baseContract["2xl"],

    scrollbarWidth: "none",
    "::-webkit-scrollbar": {
      display: "none",
    },

    maxWidth: `${breakpoints.tablet}px`,
    position: "absolute",
    overflow: "scroll",
    bottom: 0,
    "@media": {
      [minMediaQuery("tablet")]: {
        bottom: "auto",
        borderBottomLeftRadius: vars.borderRadius.baseContract["2xl"],
        borderBottomRightRadius: vars.borderRadius.baseContract["2xl"],
      },
    },
  },
]);

export const noOutline = style({ outline: "none" });

export const selectModalItemContainer = style({
  padding: "2.5px 0",
});
