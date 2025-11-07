import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../styles/theme/atoms.css";

export const headerContainer = recipe({
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    alignItems: "start",
  },
  variants: {
    page: {
      default: atoms({
        marginBottom: "5",
      }),
      steps: atoms({
        marginBottom: "5",
      }),
    },
  },
  defaultVariants: {
    page: "default",
  },
});

export const posistionDetailsInfoContainer = style([
  atoms({
    flex: 1,
    gap: "8",
    width: "0",
  }),
  {
    maxWidth: "600px",
  },
]);
