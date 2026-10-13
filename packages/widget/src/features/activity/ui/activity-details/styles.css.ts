import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";

export const page = style({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minHeight: 0,
  padding: "24px",
});

export const header = style({
  alignItems: "flex-start",
  display: "flex",
  gap: "16px",
  minWidth: 0,
});

export const heading = style({ minWidth: 0 });

const badge = style([
  atoms({ borderRadius: "base" }),
  {
    alignItems: "center",
    display: "inline-flex",
    padding: "3px 8px",
    whiteSpace: "nowrap",
  },
]);

export const badgeMuted = style([
  badge,
  { background: "color-mix(in srgb, currentColor 12%, transparent)" },
]);

export const amount = style({
  fontSize: "clamp(28px, 3vw, 40px)",
  lineHeight: 1.15,
  overflowWrap: "anywhere",
  padding: "24px 0",
});

export const rows = style({
  display: "grid",
  gap: "12px",
  padding: "20px 0",
});

export const row = style({
  alignItems: "start",
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "minmax(100px, 0.6fr) minmax(0, 1fr)",
});

export const rowValue = style({
  overflowWrap: "anywhere",
  textAlign: "right",
});

export const transactions = style({
  display: "grid",
  gap: "4px",
  padding: "20px 0",
});

export const transactionsHeader = style({
  alignItems: "baseline",
  display: "flex",
  gap: "16px",
  justifyContent: "space-between",
  marginBottom: "8px",
});

export const transaction = style({
  alignItems: "center",
  background: "none",
  border: 0,
  color: "inherit",
  display: "grid",
  font: "inherit",
  gap: "12px",
  gridTemplateColumns: "16px minmax(0, 1fr) auto",
  padding: "8px 0",
  textAlign: "left",
  width: "100%",
});

export const transactionLink = style({
  cursor: "pointer",
  selectors: {
    "&:hover": { opacity: 0.8 },
  },
});

export const transactionText = style({
  display: "grid",
  gap: "2px",
  minWidth: 0,
});

export const transactionExplorer = style({
  alignItems: "center",
  color: vars.color.textMuted,
  display: "flex",
  gap: "4px",
});

export const termsLink = style({
  color: vars.color.textMuted,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
});

export const unavailable = style([
  atoms({ background: "background", borderRadius: "xl" }),
  {
    marginTop: "16px",
    padding: "12px",
  },
]);

export const back = style({
  alignItems: "center",
  alignSelf: "flex-start",
  background: "none",
  border: 0,
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  marginBottom: "20px",
  padding: 0,
});
