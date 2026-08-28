import { style } from "@vanilla-extract/css";
import { activityFeedContainerName } from "../../../../shared/styles/tokens/containers.css";

export const container = style({
  containerName: activityFeedContainerName,
  containerType: "inline-size",
  minHeight: "300px",
});
