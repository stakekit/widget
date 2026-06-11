import { type RecipeVariants, recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
import { fineryLightPalette } from "../../../styles/theme/variant-overrides/palettes";

export const summaryContainer = recipe({
  base: atoms({
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
  }),
  variants: {
    variant: {
      default: {
        gap: "24px",
      },
      utila: {
        gap: "24px",
      },
      finery: {
        gap: "8px",
      },
      porto: {
        gap: "24px",
      },
    },
  },
});

export const summaryItem = recipe({
  base: {
    borderRadius: "16px",
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  variants: {
    state: {
      default: {
        padding: "16px",
      },
      isLoading: {},
    },
    variant: {
      default: [
        atoms({
          background: "summaryItemBackground",
          borderColor: "tabBorder",
        }),
        {
          borderRadius: "8px",
          borderWidth: "1px",
          borderStyle: "solid",
        },
      ],
      utila: [
        atoms({
          background: "summaryItemBackground",
          borderColor: "tabBorder",
        }),
        {
          borderRadius: "8px",
          borderWidth: "1px",
          borderStyle: "solid",
        },
      ],
      finery: [
        atoms({
          background: "summaryItemBackground",
        }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
        },
      ],
      porto: [
        atoms({
          background: "summaryItemBackground",
          borderColor: "transparent",
        }),
        {
          borderRadius: "8px",
          borderWidth: "1px",
          borderStyle: "solid",
        },
      ],
    },
  },
  defaultVariants: {
    state: "default",
  },
});

export const summaryNumber = recipe({
  variants: {
    variant: {
      default: [
        atoms({
          fontWeight: "medium",
        }),
        {
          fontSize: "18px",
        },
      ],
      utila: [
        atoms({
          fontWeight: "medium",
        }),
        {
          fontSize: "18px",
        },
      ],
      finery: [
        {
          fontWeight: vars.fontWeight.normal,
          fontSize: "24px",
        },
      ],
      porto: [
        atoms({
          fontWeight: "medium",
        }),
        {
          fontSize: "18px",
        },
      ],
    },
  },
});

export const summaryLabelContainer = recipe({
  variants: {
    variant: {
      default: {
        borderRadius: "4px",
        padding: "2px 6px",
      },
      utila: {
        borderRadius: "4px",
        padding: "2px 6px",
      },
      finery: {
        borderRadius: "9px",
        padding: "12px 10px",
      },
      porto: {
        borderRadius: "4px",
        padding: "4px 8px",
      },
    },
    type: {
      staked: {
        background: vars.color.summaryLabelStakedBackground,
        color: vars.color.summaryLabelStakedColor,
      },
      apy: {
        background: vars.color.summaryLabelApyBackground,
        color: vars.color.summaryLabelApyColor,
      },
      available: {
        background: vars.color.summaryLabelAvailableBackground,
        color: vars.color.summaryLabelAvailableColor,
      },
    },
  },
  compoundVariants: [
    {
      variants: {
        variant: "utila",
        type: "staked",
      },
      style: {
        background: vars.color.summaryLabelStakedBackground,
        color: vars.color.summaryLabelStakedColor,
      },
    },
    {
      variants: {
        variant: "utila",
        type: "apy",
      },
      style: {
        background: vars.color.summaryLabelApyBackground,
        color: vars.color.summaryLabelApyColor,
      },
    },
    {
      variants: {
        variant: "utila",
        type: "available",
      },
      style: {
        background: vars.color.summaryLabelAvailableBackground,
        color: vars.color.summaryLabelAvailableColor,
      },
    },
    {
      variants: {
        variant: "finery",
        type: "staked",
      },
      style: {
        background: fineryLightPalette.purpleOne,
        color: fineryLightPalette.purpleTwo,
      },
    },
    {
      variants: {
        variant: "finery",
        type: "apy",
      },
      style: {
        background: fineryLightPalette.blueOne,
        color: fineryLightPalette.blueTwo,
      },
    },
    {
      variants: {
        variant: "finery",
        type: "available",
      },
      style: {
        background: fineryLightPalette.greenThree,
        color: fineryLightPalette.greenOne,
      },
    },
    {
      variants: {
        variant: "porto",
        type: "staked",
      },
      style: [
        {
          color: vars.color.summaryLabelStakedColor,
          background: vars.color.summaryLabelStakedBackground,
        },
      ],
    },
    {
      variants: {
        variant: "porto",
        type: "apy",
      },
      style: [
        {
          color: vars.color.summaryLabelApyColor,
          background: vars.color.summaryLabelApyBackground,
        },
      ],
    },
    {
      variants: {
        variant: "porto",
        type: "available",
      },
      style: [
        {
          color: vars.color.summaryLabelAvailableColor,
          background: vars.color.summaryLabelAvailableBackground,
        },
      ],
    },
  ],
});

export const summaryLabel = recipe({
  variants: {
    variant: {
      default: {
        color: "inherit",
        fontSize: "12px",
      },
      utila: {
        color: "inherit",
        fontSize: "12px",
      },
      finery: {
        color: "inherit",
        fontSize: "12px",
      },
      porto: [
        {
          color: "inherit",
          fontSize: "12px",
          fontWeight: "lighter",
        },
      ],
    },
  },
});

export type SummaryLabelContainerVariants = RecipeVariants<
  typeof summaryLabelContainer
>;
