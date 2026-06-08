import { style } from "@vanilla-extract/css";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

const lighterBackground = (background: string) =>
  `color-mix(in oklab, ${background} 88%, white)`;

export const pressAnimation = style({
  transition: "transform 0.1s ease-in-out",
  ":active": {
    transform: "scale(0.98)",
  },
});

export const selectTokenButton = recipe({
  variants: {
    variant: {
      default: [atoms({ background: "background" })],
      utila: [atoms({ background: "background" })],
      finery: [
        {
          background: vars.color.tokenSelectBackground,
        },
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
          ":hover": {
            background: vars.color.tokenSelectHoverBackground,
          },
        },
      ],
    },
  },
});

export const buttonStyle = recipe({
  base: [
    { borderStyle: "solid" },
    atoms({
      letterSpacing: "tight",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "2",
      width: "full",
      border: "none",
      fontSize: "lg",
      fontWeight: "primaryButton",
      borderRadius: "primaryButton",
    }),
  ],

  variants: {
    variant: {
      default: {},
      utila: {},
    },
    color: {
      primary: [
        atoms({
          background: "primaryButtonBackground",
          color: "primaryButtonColor",
          borderRadius: "primaryButton",
          fontWeight: "primaryButton",
        }),
        {
          borderColor: vars.color.primaryButtonBackground,
          ":hover": {
            background: lighterBackground(vars.color.primaryButtonBackground),
            borderColor: lighterBackground(vars.color.primaryButtonBackground),
          },
        },
      ],
      secondary: [
        atoms({
          background: "secondaryButtonBackground",
          color: "secondaryButtonColor",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          borderColor: vars.color.secondaryButtonColor,
          ":hover": {
            background: lighterBackground(vars.color.secondaryButtonBackground),
          },
        },
      ],
      disabled: [
        { transition: "none", transform: "none" },
        atoms({
          background: "disabledButtonBackground",
          color: "disabledButtonColor",
        }),
        {
          borderColor: vars.color.disabledButtonBackground,
          ":active": {
            transform: "none",
          },
        },
      ],
      smallButton: [
        atoms({
          background: "smallButtonBackground",
          color: "smallButtonColor",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          borderColor: vars.color.smallButtonBackground,
          ":hover": {
            background: lighterBackground(vars.color.smallButtonBackground),
            borderColor: lighterBackground(vars.color.smallButtonBackground),
          },
        },
      ],
      smallButtonLight: [
        atoms({
          background: "smallLightButtonBackground",
          color: "smallLightButtonColor",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          borderColor: vars.color.smallLightButtonBackground,
          ":hover": {
            background: lighterBackground(
              vars.color.smallLightButtonBackground
            ),
            borderColor: lighterBackground(
              vars.color.smallLightButtonBackground
            ),
          },
        },
      ],
    },
    animation: {
      none: {},
      press: [pressAnimation],
    },

    height: {
      small: atoms({ minHeight: "12" }),
    },
    border: {
      regular: atoms({ borderWidth: 1 }),
    },
    size: {
      regular: atoms({ minHeight: "buttonMinHeight" }),
      small: [
        style({
          padding: "9.8px 13.1px",
          width: "auto",
        }),
        atoms({
          minHeight: "auto",
          px: "6",
          py: "3",
          borderRadius: "smallButton",
        }),
      ],
    },
  },

  defaultVariants: {
    color: "primary",
    animation: "press",
    border: "regular",
    size: "regular",
  },
});

export type ButtonVariants = RecipeVariants<typeof buttonStyle>;
