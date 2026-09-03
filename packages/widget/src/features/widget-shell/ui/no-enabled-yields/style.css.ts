import { style } from "@vanilla-extract/css";
import { animationContainer } from "../layout.css";

export const background = style([animationContainer, { minHeight: "560px" }]);

export const dashboardBackground = style({
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: "600px",
});

export const container = style({
  flexGrow: 1,
  paddingLeft: "25px",
  paddingRight: "25px",
});
