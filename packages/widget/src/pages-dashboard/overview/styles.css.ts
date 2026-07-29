import { style } from "@vanilla-extract/css";
import { splitExpandedContainerQuery } from "../../styles/tokens/breakpoints";

export const overviewPageContainer = style({
  "@container": {
    [splitExpandedContainerQuery]: {
      maxWidth: "380px",
    },
  },
});
