import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./contract.css";
import { dashboardLayoutSelector, rootSelector } from "./ids";

// The element reset is the Design System's scoped `src/ui/theme/reset.css`.

globalStyle(rootSelector, {
  fontFamily: vars.font.body,
});

globalStyle(`${dashboardLayoutSelector} ${rootSelector}`, {
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: "1000px",
  width: "100%",
});
