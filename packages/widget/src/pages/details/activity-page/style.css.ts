import {
  widgetContainerMaxWidth,
  widgetContainerName,
} from "@sk-widget/style.css";
import { atoms } from "@sk-widget/styles";
import { minContainerWidth } from "@sk-widget/styles/tokens/breakpoints";
import { style } from "@vanilla-extract/css";

export const container = style({
  minHeight: "300px",
});

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});

export const activityDetailsContainer = style([
  atoms({ gap: { mobile: "1", tablet: "2" } }),
  {
    display: "flex",

    justifyContent: "center",

    alignItems: "flex-start",
    flexDirection: "column-reverse",

    "@container": {
      [minContainerWidth(widgetContainerName, widgetContainerMaxWidth)]: {
        alignItems: "center",
        flexDirection: "row",
      },
    },
  },
]);

export const listItem = style([
  atoms({ gap: "1" }),
  { flexDirection: "column" },
]);

export const noWrap = style({
  whiteSpace: "nowrap",
});
