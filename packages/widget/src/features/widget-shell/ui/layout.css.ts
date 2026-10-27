import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { vars } from "../../../shared/styles/theme/contract.css";
import {
  compactLayoutSelector,
  dashboardLayoutSelector,
} from "../../../shared/styles/theme/ids";
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
    layout: {
      compact: {},
      dashboard: { display: "flex", justifyContent: "center" },
    },
  },
});

export const animationPage = style({
  selectors: {
    [`${dashboardLayoutSelector} &`]: {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      minHeight: 0,
    },
  },
});

export const pageContainer = style({
  selectors: {
    [`${compactLayoutSelector} &`]: {
      paddingLeft: vars.space["4"],
      paddingRight: vars.space["4"],
      paddingTop: vars.space["2"],
    },
    [`${dashboardLayoutSelector} &`]: { gap: vars.space["2"] },
  },
});

export const pageCta = style({
  selectors: {
    [`${compactLayoutSelector} &`]: { paddingTop: vars.space["8"] },
  },
});

export const poweredBy = style({
  selectors: {
    [`${compactLayoutSelector} &`]: { paddingTop: vars.space["3"] },
  },
});
