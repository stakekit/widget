import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { minContainerWidth } from "../../../shared/styles/tokens/breakpoints";
import {
  appContainerName,
  widgetContainerName,
} from "../../../shared/styles/tokens/containers.css";

const widgetContainerMaxWidth = 400;

export const animationContainer = style([
  atoms({ background: "background" }),
  {
    "@container": {
      [minContainerWidth(appContainerName, "tablet")]: {
        marginBottom: "50px",
      },
    },
    borderRadius: "20px",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    containerName: widgetContainerName,
    containerType: "inline-size",
    display: "flex",
    flexDirection: "column",
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: widgetContainerMaxWidth,
    overflow: "hidden",
    position: "relative",
  },
]);

export const container = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    height: "full",
    justifyContent: "flex-end",
    position: "relative",
  }),
]);

export const appContainer = recipe({
  base: {
    containerName: appContainerName,
    containerType: "inline-size",
    minHeight: "800px",
  },
  variants: {
    variant: {
      dashboard: { display: "flex", justifyContent: "center" },
      widget: {},
    },
  },
  defaultVariants: { variant: "widget" },
});
