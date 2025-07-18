import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const rootClassName = recipe({
  base: {
    margin: 0,

    paddingBottom: "40px",

    "@media": {
      "(max-width: 520px)": {
        paddingTop: "0",
      },
    },
  },
  variants: {
    variant: {
      default: {},
      finery: {},
      utila: {},
    },
    theme: {
      dark: {},
      light: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        theme: "dark",
        variant: "finery",
      },
      style: {
        background: "#1A2022",
      },
    },
    {
      variants: {
        theme: "light",
      },
      style: {
        background: "#f8f8f9",
      },
    },
    {
      variants: {
        theme: "dark",
      },
      style: {
        background: "#211f25",
      },
    },
  ],

  defaultVariants: {
    theme: "dark",
    variant: "default",
  },
});

export const toggleThemeButtonContainerClassName = style({
  display: "flex",
  justifyContent: "flex-end",
  padding: "40px",
});

export const toggleThemeButtonClassName = recipe({
  base: {
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    backdropFilter: "blur(10px)",

    ":active": {
      transform: "translateY(0)",
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
    },

    ":focus": {
      outline: "none",
    },
  },
  variants: {
    theme: {
      dark: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        color: "rgba(255, 255, 255, 0.9)",

        ":hover": {
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          borderColor: "rgba(255, 255, 255, 0.25)",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        },

        ":focus": {
          boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.1)",
        },
      },
      light: {
        backgroundColor: "rgba(0, 0, 0, 0.05)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        color: "rgba(0, 0, 0, 0.8)",

        ":hover": {
          backgroundColor: "rgba(0, 0, 0, 0.08)",
          borderColor: "rgba(0, 0, 0, 0.15)",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        },

        ":focus": {
          boxShadow: "0 0 0 3px rgba(0, 0, 0, 0.05)",
        },
      },
    },
  },
  defaultVariants: {
    theme: "dark",
  },
});
