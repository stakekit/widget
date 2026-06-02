import { keyframes, style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
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
  zIndex: 20,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "fixed",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});

export const overlay = style({
  animation: `${fadeIn} 150ms ease`,
  willChange: "opacity",
  position: "absolute",
  inset: 0,
  background: vars.color.modalOverlayBackground,
});

export const content = style([
  {
    "@media": {
      [minMediaQuery("tablet")]: {
        width: "440px",
        height: "640px",
        maxHeight: "85vh",
        bottom: "auto",
        borderBottomLeftRadius: vars.borderRadius.baseContract["2xl"],
        borderBottomRightRadius: vars.borderRadius.baseContract["2xl"],
      },
    },
    animation: `${slideUp} 350ms cubic-bezier(.15,1.15,0.6,1.00), ${fadeIn} 150ms ease`,
    willChange: "transform, opacity",
  },
  atoms({
    width: "full",
    background: "modalBodyBackground",
  }),
  {
    display: "flex",
    flexDirection: "column",
    borderTopLeftRadius: vars.borderRadius.baseContract["2xl"],
    borderTopRightRadius: vars.borderRadius.baseContract["2xl"],
    maxWidth: `${breakpoints.tablet}px`,
    position: "absolute",
    height: "90vh",
    bottom: 0,
  },
]);

export const iframe = style({
  flex: 1,
  width: "100%",
  border: "none",
});
