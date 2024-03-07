import { style } from "@vanilla-extract/css";
import { atoms } from "../../styles";

export const caretContainer = style({
  transition: "transform 0.2s ease",
});

export const rotate180deg = style({
  transform: "rotate(180deg)",
});

export const providerContainer = style({
  transition: "max-height 0.5s ease",
  overflow: "hidden",
});

export const container = style({ minHeight: "400px" });

export const inactiveContainer = style([
  atoms({
    borderRadius: "base",
    background: "positionsActionRequiredBackground",
  }),
  { padding: "2px 6px" },
]);

export const noWrap = style({ whiteSpace: "nowrap" });
