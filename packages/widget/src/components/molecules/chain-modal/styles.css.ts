import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const container = recipe({
  base: {
    cursor: "pointer",
    transition: "0.125s ease",
    ":hover": {
      transform: "scale(1.025)",
    },
    ":active": {
      transform: "scale(0.95)",
    },
  },
  variants: {
    variant: {
      default: {},
      finery: {
        background: vars.color.__internal__finery__summary__item__background__,
        boxShadow: "0px 15px 30px 0px #0000000D",
      },
    },
  },
});

export const titleStyle = style([atoms({ fontWeight: "modalHeading" })]);
