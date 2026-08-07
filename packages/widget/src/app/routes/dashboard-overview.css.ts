import { style } from "@vanilla-extract/css";
import { splitExpandedContainerQuery } from "../../shared/styles/tokens/breakpoints";

export const overviewPageContainer = style({
  "@container": {
    [splitExpandedContainerQuery]: {
      maxWidth: "380px",
    },
  },
});

export const earnDetailsWrapper = style({
  alignSelf: "stretch",
  minHeight: "620px",
  minWidth: 0,
  position: "relative",
});
