import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { splitExpandedContainerQuery } from "../../../../shared/styles/tokens/breakpoints";

export const posistionDetailsInfoContainer = style([
  atoms({
    flex: 1,
    gap: "8",
    width: "0",
  }),
  {
    "@container": {
      [splitExpandedContainerQuery]: {
        maxWidth: "600px",
      },
    },
  },
]);

export const positionDetailsActionsContainer = style({
  "@container": {
    [splitExpandedContainerQuery]: {
      maxWidth: "380px",
    },
  },
});

export const breadcrumb = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "2",
  }),
  {
    minWidth: 0,
  },
]);

export const breadcrumbName = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
