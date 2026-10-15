import { globalStyle, layer } from "@vanilla-extract/css";
import { vars } from "./contract.css";
import { dashboardLayoutSelector, rootSelector } from "./ids";

const reset = layer("reset");

globalStyle(rootSelector, {
  "@layer": {
    [reset]: {
      fontFamily: vars.font.body,
    },
  },
});

globalStyle(`${dashboardLayoutSelector} ${rootSelector}`, {
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: "1000px",
  width: "100%",
});

// Resets
globalStyle(`${rootSelector} *`, {
  "@layer": {
    [reset]: {
      margin: 0,
      boxSizing: "border-box",
      WebkitTapHighlightColor: "transparent",
    },
  },
});

globalStyle(`${rootSelector} button, input, select, textarea`, {
  "@layer": {
    [reset]: {
      fontFamily: "inherit",
      fontSize: "100%",
    },
  },
});

globalStyle(`${rootSelector} input`, {
  "@layer": {
    [reset]: {
      background: "transparent",
    },
  },
});

globalStyle(`${rootSelector} button`, {
  "@layer": {
    [reset]: {
      all: "unset",
      cursor: "pointer",
    },
  },
});

globalStyle(
  `${rootSelector} input::-webkit-outer-spin-button, input::-webkit-inner-spin-button`,
  {
    "@layer": {
      [reset]: {
        WebkitAppearance: "none",
        margin: "0",
      },
    },
  }
);

globalStyle(`${rootSelector} input[type=number]`, {
  "@layer": {
    [reset]: {
      MozAppearance: "textfield",
    },
  },
});

globalStyle(
  ".simple-display-wallet-list-sub-icon > img, .simple-display-wallet-list-icon > img",
  {
    "@layer": {
      [reset]: {
        maxWidth: "100%",
        height: "auto",
      },
    },
  }
);

globalStyle("button.simple-display-wallet-button", {
  "@layer": {
    [reset]: {
      width: "auto",
      height: "auto",
    },
  },
});

globalStyle(".simple-display-wallet-list-icon", {
  "@layer": {
    [reset]: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
  },
});
