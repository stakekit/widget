import { keyframes } from "@vanilla-extract/css";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

const rotate = keyframes({
  "100%": { transform: "rotate(360deg)" },
});

const prixClipFix = keyframes({
  "0%": { clipPath: "polygon(50% 50%,0 0,0 0,0 0,0 0,0 0)" },
  "25%": { clipPath: "polygon(50% 50%,0 0,100% 0,100% 0,100% 0,100% 0)" },
  "50%": {
    clipPath: "polygon(50% 50%,0 0,100% 0,100% 100%,100% 100%,100% 100%)",
  },
  "75%": { clipPath: "polygon(50% 50%,0 0,100% 0,100% 100%,0 100%,0 100%)" },
  "100%": { clipPath: "polygon(50% 50%,0 0,100% 0,100% 100%,0 100%,0 0)" },
});

export const spinnerStyles = recipe({
  base: {
    borderRadius: "50%",
    position: "relative",
    animation: "rotate 1s linear infinite",
    animationName: rotate,
    animationDuration: "1s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    ":before": {
      content: "",
      boxSizing: "border-box",
      position: "absolute",
      inset: "0px",
      borderRadius: "50%",
      borderWidth: "3px",
      borderStyle: "solid",
      animationName: prixClipFix,
      animationDuration: "2s",
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
    },
  },
  variants: {
    size: {
      regular: { width: "24px", height: "24px" },
      small: { width: "18px", height: "18px" },
    },
    color: {
      regular: [atoms({ borderColor: "accent", color: "accent" })],
      inverted: [atoms({ borderColor: "white", color: "background" })],
    },
  },
  defaultVariants: {
    size: "regular",
    color: "regular",
  },
});

export type SpinnerVariants = RecipeVariants<typeof spinnerStyles>;
