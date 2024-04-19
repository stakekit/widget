import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { atoms, vars } from "../../../styles";
import { style } from "@vanilla-extract/css";

export const pressAnimation = style({
  transition: "transform 0.1s ease-in-out",
  ":active": {
    transform: "scale(0.98)",
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

      // TODO: Fix this, button types are not clear
      smallButton: [
        atoms({
          background: "secondaryButtonBackground",
          color: "secondaryButtonColor",
          borderColor: "secondaryButtonBackground",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          ":hover": {
            background: vars.color.secondaryButtonBackground,
            color: vars.color.secondaryButtonHoverColor,
            borderColor: vars.color.secondaryButtonBackground,
          },
          ":active": {
            background: vars.color.secondaryButtonBackground,
            color: vars.color.secondaryButtonActiveColor,
            borderColor: vars.color.secondaryButtonBackground,
          },
        },
      ],
      smallButtonLight: [
        atoms({
          background: "stakeSectionBackground",
          color: "secondaryButtonColor",
          borderColor: "stakeSectionBackground",
          borderRadius: "secondaryButton",
          fontWeight: "secondaryButton",
        }),
        {
          ":hover": {
            background: vars.color.stakeSectionBackground,
            color: vars.color.secondaryButtonHoverColor,
            borderColor: vars.color.stakeSectionBackground,
          },
          ":active": {
            background: vars.color.stakeSectionBackground,
            color: vars.color.secondaryButtonActiveColor,
            borderColor: vars.color.stakeSectionBackground,
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
          borderRadius: "7.38px",
        }),
        atoms({
          minHeight: "auto",
          px: "6",
          py: "3",
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
