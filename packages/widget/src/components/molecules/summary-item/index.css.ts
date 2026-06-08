import { type RecipeVariants, recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
import {
  fineryLightPalette,
  portoPalette,
  utilaPalette,
} from "../../../styles/theme/variant-overrides/palettes";

export const summaryContainer = recipe({
  base: atoms({
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
  }),
  variants: {
    variant: {
      default: [
        atoms({
          gap: "8",
        }),
      ],
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
        }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
        },
      ],
      utila: [
        atoms({
          background: "summaryItemBackground",
          borderColor: "transparent",
        }),
        {
          borderColor: utilaPalette.border,
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
      default: {
        fontSize: "28px",
      },
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
        borderRadius: "9px",
        padding: "12px 10px",
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
        background: "#F0EDFA",
        color: "#5A36C0",
      },
      apy: {
        background: "#EDF1F5",
        color: "#0059AB",
      },
      available: {
        background: "#EDF6F3",
        color: "#00794E",
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
        background: "#F6F0FF",
        color: "#5A36C0",
      },
    },
    {
      variants: {
        variant: "utila",
        type: "apy",
      },
      style: {
        background: "#F7ECFA",
        color: "#CA6CBD",
      },
    },
    {
      variants: {
        variant: "utila",
        type: "available",
      },
      style: {
        background: "#EEF7F3",
        color: "#327C5F",
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
          color: "white",
          background: portoPalette.greyThree,
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
          color: "white",
          background: portoPalette.greyThree,
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
          color: "white",
          background: portoPalette.greyThree,
        },
      ],
    },
  ],
});

export const summaryLabel = recipe({
  variants: {
    variant: {
      default: {},
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
