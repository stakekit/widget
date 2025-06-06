import { createContainer, style } from "@vanilla-extract/css";

export const widgetContainerName = createContainer();
export const widgetContainerMaxWidth = 400;

export const animationContainer = style([
  {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    containerType: "inline-size",
    containerName: widgetContainerName,
    maxWidth: "1000px",
  },
]);
