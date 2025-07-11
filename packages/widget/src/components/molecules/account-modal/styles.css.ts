import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

export const container = style({
  cursor: "pointer",
  transition: "0.125s ease",
  ":hover": {
    transform: "scale(1.025)",
  },
  ":active": {
    transform: "scale(0.95)",
  },
});

export const titleStyle = style([atoms({ fontWeight: "modalHeading" })]);

export const avatarContainer = style({ overflow: "hidden" });
