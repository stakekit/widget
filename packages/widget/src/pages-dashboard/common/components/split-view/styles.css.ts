import { keyframes, style } from "@vanilla-extract/css";
import { atoms } from "../../../../styles/theme/atoms.css";
import { vars } from "../../../../styles/theme/contract.css";
import { OUTLET_PADDING } from "../styles.css";

export const container = style({
  alignItems: "stretch",
  display: "flex",
  flexDirection: "row",
  gap: "24px",
  justifyContent: "center",
  minWidth: 0,
  width: "100%",
});

export const panelWrapContents = style({
  display: "contents",
});

export const panelWrapHidden = style({
  display: "none",
});

const reduceMotion = "(prefers-reduced-motion: reduce)";

const slideInFromLeft = keyframes({
  from: { opacity: 0, transform: "translateX(-16px)" },
  to: { opacity: 1, transform: "translateX(0)" },
});

const slideInFromRight = keyframes({
  from: { opacity: 0, transform: "translateX(16px)" },
  to: { opacity: 1, transform: "translateX(0)" },
});

const panelWrapActiveBase = style({
  display: "flex",
  flex: 1,
  flexDirection: "row",
  minWidth: 0,
});

export const panelWrapActiveFromLeft = style([
  panelWrapActiveBase,
  {
    animation: `${slideInFromLeft} 260ms ease`,
    "@media": {
      [reduceMotion]: { animation: "none" },
    },
  },
]);

export const panelWrapActiveFromRight = style([
  panelWrapActiveBase,
  {
    animation: `${slideInFromRight} 260ms ease`,
    "@media": {
      [reduceMotion]: { animation: "none" },
    },
  },
]);

export const bar = style([
  atoms({
    background: "stakeSectionBackground",
  }),
  {
    alignItems: "center",
    alignSelf: "stretch",
    border: 0,
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    font: "inherit",
    gap: "8px",
    justifyContent: "center",
    padding: "12px 0",
    transition: "background 150ms ease",
    width: "30px",
    selectors: {
      "&:hover": {
        background: vars.color.backgroundMuted,
      },
    },
  },
]);

/**
 * Bleed the bar outward into the dashboard outlet padding, leaving an 8px gap
 * to the card edge on whichever side it currently lives.
 */
export const barBleedRight = style({
  marginRight: `calc(8px - ${OUTLET_PADDING})`,
});

export const barBleedLeft = style({
  marginLeft: `calc(8px - ${OUTLET_PADDING})`,
});

export const barIcon = style({
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  transition: "transform 200ms ease",
  "@media": {
    [reduceMotion]: { transition: "none" },
  },
});

export const barIconFlipped = style({
  transform: "rotate(180deg)",
});

export const barLabel = style({
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  writingMode: "vertical-rl",
});
