import { style } from "@vanilla-extract/css";
import { splitExpandedMediaQuery } from "../../styles/tokens/breakpoints";

export const overviewPageContainer = style({
  "@media": {
    [splitExpandedMediaQuery]: {
      maxWidth: "380px",
    },
  },
});
