import { style } from "@vanilla-extract/css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import {
  compactLayoutSelector,
  dashboardLayoutSelector,
} from "../../../../shared/styles/theme/ids";
import { minContainerWidth } from "../../../../shared/styles/tokens/breakpoints";
import {
  appContainerName,
  widgetContainerName,
} from "../../../../shared/styles/tokens/containers.css";

/**
 * The notice frame: the widget card in the Compact Layout, the bordered
 * dashboard card in the Dashboard Layout.
 */
export const frame = style({
  background: vars.color.background,
  borderRadius: "14px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  selectors: {
    [`${compactLayoutSelector} &`]: {
      containerName: widgetContainerName,
      containerType: "inline-size",
      marginLeft: "auto",
      marginRight: "auto",
      maxWidth: 400,
      minHeight: "560px",
      position: "relative",
    },
    [`${dashboardLayoutSelector} &`]: {
      borderColor: vars.color.backgroundMuted,
      borderStyle: "solid",
      borderWidth: "1px",
      boxShadow: "0px 15px 40px 0px #0000000D",
      maxWidth: "1000px",
      minHeight: "600px",
      minWidth: "100%",
      width: "100%",
    },
  },
  "@container": {
    [minContainerWidth(appContainerName, "tablet")]: {
      selectors: {
        [`${compactLayoutSelector} &`]: { marginBottom: "50px" },
      },
    },
  },
});

export const container = style({
  flexGrow: 1,
  paddingLeft: "25px",
  paddingRight: "25px",
});
