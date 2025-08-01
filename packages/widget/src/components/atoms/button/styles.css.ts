import { style } from "@vanilla-extract/css";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

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
        atoms({ background: "__internal__finery__grey__two__" }),
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
          borderColor: "primaryButtonOutline",
          borderRadius: "primaryButton",
          fontWeight: "primaryButton",
        }),
        {
          ":hover": {
            background: vars.color.primaryButtonHoverBackground,
            color: vars.color.primaryButtonHoverColor,
            borderColor: vars.color.primaryButtonHoverOutline,
          },
          ":active": {
            background: vars.color.primaryButtonActiveBackground,
            color: vars.color.primaryButtonActiveColor,
            borderColor: vars.color.primaryButtonActiveOutline,
          },
        },
      ],
      secondary: [
        atoms({
          background: "secondaryButtonBackground",
          color: "secondaryButtonColor",
          borderColor: "secondaryButtonOutline",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          ":hover": {
            background: vars.color.secondaryButtonHoverBackground,
            color: vars.color.secondaryButtonHoverColor,
            borderColor: vars.color.secondaryButtonHoverOutline,
          },
          ":active": {
            background: vars.color.secondaryButtonActiveBackground,
            color: vars.color.secondaryButtonActiveColor,
            borderColor: vars.color.secondaryButtonActiveOutline,
          },
        },
      ],
      disabled: [
        { transition: "none", transform: "none" },
        atoms({
          background: "disabledButtonBackground",
          color: "disabledButtonColor",
          borderColor: "disabledButtonOutline",
        }),
        {
          ":active": {
            transform: "none",
          },
        },
      ],
      smallButton: [
        atoms({
          background: "smallButtonBackground",
          color: "smallButtonColor",
          borderColor: "smallButtonOutline",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          ":hover": {
            background: vars.color.smallButtonHoverBackground,
            color: vars.color.secondaryButtonHoverColor,
            borderColor: vars.color.smallButtonHoverOutline,
          },
          ":active": {
            background: vars.color.smallButtonActiveBackground,
            color: vars.color.secondaryButtonActiveColor,
            borderColor: vars.color.smallButtonActiveOutline,
          },
        },
      ],
      smallButtonLight: [
        atoms({
          background: "smallLightButtonBackground",
          color: "smallLightButtonColor",
          borderColor: "smallLightButtonOutline",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          ":hover": {
            background: vars.color.smallLightButtonHoverBackground,
            color: vars.color.smallLightButtonHoverColor,
            borderColor: vars.color.smallLightButtonHoverOutline,
          },
          ":active": {
            background: vars.color.smallLightButtonActiveBackground,
            color: vars.color.smallLightButtonActiveColor,
            borderColor: vars.color.smallLightButtonActiveOutline,
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
