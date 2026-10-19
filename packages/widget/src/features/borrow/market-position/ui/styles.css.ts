import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";

export const ltvGauge = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "2",
  }),
]);

export const ltvGaugeTrack = style({
  background: `linear-gradient(90deg, ${vars.color.statusSuccess} 0%, ${vars.color.statusWarning} 52%, ${vars.color.textDanger} 100%)`,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "10px",
  overflow: "hidden",
  position: "relative",
});

export const ltvGaugeMarker = style({
  background: vars.color.text,
  border: `2px solid ${vars.color.background}`,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "14px",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "14px",
});

export const ltvGaugeThreshold = style({
  background: vars.color.background,
  height: "100%",
  position: "absolute",
  top: 0,
  transform: "translateX(-50%)",
  width: "2px",
});

export const ltvGaugeLabels = style({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
});

export const healthValue = style({
  color: vars.color.statusSuccess,
});

export const healthValueWarning = style({
  color: vars.color.statusWarning,
});

export const healthValueDanger = style({
  color: vars.color.textDanger,
});

export const collateralList = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "2",
  }),
]);

export const collateralListButton = style({
  alignItems: "center",
  background: "transparent",
  border: 0,
  color: vars.color.text,
  cursor: "pointer",
  display: "flex",
  font: "inherit",
  gap: "8px",
  padding: 0,
  textAlign: "left",
  width: "100%",
});

export const collateralRow = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    px: "3",
    py: "3",
  }),
  {
    alignItems: "center",
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) auto",
  },
]);

export const switchButton = style({
  alignItems: "center",
  // The row is `stakeSectionBackground`, which equals `backgroundMuted` in the
  // light theme, so derive the off track from the text colour to keep it visible.
  background: `color-mix(in oklab, ${vars.color.text} 30%, ${vars.color.stakeSectionBackground})`,
  border: 0,
  borderRadius: vars.borderRadius.baseContract.full,
  cursor: "pointer",
  display: "inline-flex",
  height: "20px",
  padding: "2px",
  width: "36px",
});

export const switchButtonChecked = style({
  background: vars.color.statusSuccess,
});

export const switchButtonDisabled = style({
  cursor: "not-allowed",
  opacity: 0.5,
});

export const collateralRowNote = style({
  gridColumn: "1 / -1",
});

export const switchThumb = style({
  background: vars.color.white,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "16px",
  transform: "translateX(0)",
  transition: "transform 150ms ease",
  width: "16px",
});

export const switchThumbChecked = style({
  transform: "translateX(16px)",
});

export const formCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "3",
    px: "4",
    py: "4",
  }),
]);

export const checkboxRow = style({
  alignItems: "center",
  display: "flex",
  gap: "10px",
  justifyContent: "space-between",
});

export const checkbox = style({
  height: "18px",
  width: "18px",
});

export const actionCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    gap: "3",
    px: "4",
    py: "4",
  }),
  {
    alignItems: "center",
    justifyContent: "space-between",
  },
]);
