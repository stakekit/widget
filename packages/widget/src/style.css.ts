import { createContainer, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "./styles/theme/atoms.css";
import { minContainerWidth } from "./styles/tokens/breakpoints";

const appContainerName = createContainer();
export const widgetContainerName = createContainer();
export const widgetContainerMaxWidth = 400;

export const animationContainer = style([
  atoms({ background: "background" }),
  {
    position: "relative",
    borderRadius: "20px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    marginLeft: "auto",
    marginRight: "auto",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    maxWidth: widgetContainerMaxWidth,
    containerType: "inline-size",
    containerName: widgetContainerName,
    "@container": {
      [minContainerWidth(appContainerName, "tablet")]: {
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

export const appContainer = recipe({
  base: {
    minHeight: "800px",
    containerType: "inline-size",
    containerName: appContainerName,
  },
  variants: {
    variant: {
      widget: {},
      dashboard: {
        display: "flex",
        justifyContent: "center",
      },
    },
  },
  defaultVariants: {
    variant: "widget",
  },
});
