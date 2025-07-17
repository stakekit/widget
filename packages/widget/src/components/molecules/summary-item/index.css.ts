import { style } from "@vanilla-extract/css";
import { type RecipeVariants, recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

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
          background: "background",
        }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
        },
      ],
      utila: [
        atoms({
          background: "background",
          borderColor: "__internal__utila__border__",
        }),
        {
          borderRadius: "8px",
          borderWidth: "1px",
          borderStyle: "solid",
        },
      ],
      finery: [
        atoms({
          background: "__internal__finery__summary__item__background__",
        }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
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
    },
    type: {
      staked: {
        backgroundColor: "#F0EDFA",
        color: "#5A36C0",
      },
      rewards: {
        backgroundColor: "#EDF1F5",
        color: "#0059AB",
      },
      available: {
        backgroundColor: "#EDF6F3",
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
        backgroundColor: "#F6F0FF",
        color: "#5A36C0",
      },
    },
    {
      variants: {
        variant: "utila",
        type: "rewards",
      },
      style: {
        backgroundColor: "#F7ECFA",
        color: "#CA6CBD",
      },
    },
    {
      variants: {
        variant: "utila",
        type: "available",
      },
      style: {
        backgroundColor: "#EEF7F3",
        color: "#327C5F",
      },
    },
    {
      variants: {
        variant: "finery",
        type: "staked",
      },
      style: {
        backgroundColor: vars.color.__internal__finery__purple__one__,
        color: vars.color.__internal__finery__purple__two__,
      },
    },
    {
      variants: {
        variant: "finery",
        type: "rewards",
      },
      style: {
        backgroundColor: vars.color.__internal__finery__blue__one__,
        color: vars.color.__internal__finery__blue__two__,
      },
    },
    {
      variants: {
        variant: "finery",
        type: "available",
      },
      style: {
        backgroundColor: vars.color.__internal__finery__green__three__,
        color: vars.color.__internal__finery__green__one__,
      },
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
    },
  },
});

export type SummaryLabelContainerVariants = RecipeVariants<
  typeof summaryLabelContainer
>;

export const loader = style({
  flex: 1,
});

export const loaderContainer = style({
  minHeight: "50px",
  padding: "8px 16px",
});
