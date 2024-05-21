import { style } from "@vanilla-extract/css";
import { atoms } from "./styles";
import { minMediaQuery } from "./styles/tokens/breakpoints";

export const animationContainer = style([
  atoms({ background: "background" }),
  {
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    marginLeft: "auto",
    marginRight: "auto",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    "@media": {
      [minMediaQuery("tablet")]: {
        width: "400px",
        borderRadius: "20px",
        marginBottom: "50px",
      },
    },
  },
]);
export const container = style([
  atoms({
    position: "relative",
    height: "full",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  }),
]);

export const appContainer = style({
  minHeight: "800px",
});
