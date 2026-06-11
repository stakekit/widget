import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../styles/theme/atoms.css";
import { vars } from "../../../../../styles/theme/contract.css";

export const priceTxt = style({
  flexGrow: 999,
});

export const selectTokenSection = recipe({
  base: atoms({
    borderRadius: "xl",
  }),
  variants: {
    variant: {
      default: {
        background: "transparent",
      },
      utila: {
        background: "transparent",
      },
      finery: {},
      porto: {
        borderRadius: "8px",
      },
    },
    state: {
      default: {},
      danger: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        state: "danger",
        variant: "default",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "default",
      },
      style: {
        borderColor: vars.color.tokenSelectBorder,
      },
    },
    {
      variants: {
        state: "danger",
        variant: "utila",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "utila",
      },
      style: {
        borderColor: vars.color.tokenSelectBorder,
      },
    },
    {
      variants: {
        state: "danger",
        variant: "finery",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "finery",
      },
      style: {
        borderColor: vars.color.tokenSelectBackground,
      },
    },
    {
      variants: {
        state: "danger",
        variant: "porto",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "porto",
      },
      style: {
        borderColor: vars.color.tokenSelectBorder,
      },
    },
  ],
});

export const selectTokenTitle = recipe({
  variants: {
    variant: {
      default: {
        fontSize: "14px",
      },
      utila: {
        fontSize: "14px",
      },
      porto: {
        fontSize: "14px",
      },
    },
  },
});

export const selectTokenBalance = recipe({
  variants: {
    variant: {
      default: {},
      utila: {},
      finery: {
        color: vars.color.text,
      },
      porto: {},
    },
  },
});

export const minMaxContainer = recipe({
  base: [
    atoms({
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
    }),
  ],
  variants: {
    variant: {
      default: atoms({
        marginTop: "2",
      }),
      utila: atoms({
        marginTop: "2",
      }),
      porto: atoms({
        marginTop: "2",
      }),
      zerion: {},
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
