import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../styles/theme/atoms.css";
import { vars } from "../../../../../styles/theme/contract.css";
import {
  portoPalette,
  utilaPalette,
} from "../../../../../styles/theme/variant-overrides/palettes";

export const priceTxt = style({
  flexGrow: 999,
});

export const selectTokenSection = recipe({
  base: atoms({
    borderRadius: "xl",
  }),
  variants: {
    variant: {
      default: atoms({
        background: "stakeSectionBackground",
      }),
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
        variant: "default",
      },
      style: {
        borderColor: "transparent",
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
        borderColor: utilaPalette.selectTokenBorder,
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
        borderColor: portoPalette.primaryPurple,
      },
    },
  ],
});

export const selectTokenTitle = recipe({
  variants: {
    variant: {
      default: {},
      utila: {
        fontSize: "16px",
      },
      porto: {
        fontSize: "16px",
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

export const selectedListItem = recipe({
  base: [
    atoms({
      background: "tokenSelectHoverBackground",
    }),
    {
      border: `1px solid ${vars.color.accent}`,
      selectors: {
        "&:hover": {
          background: vars.color.tokenSelectHoverBackground,
        },
      },
    },
  ],
  variants: {
    variant: {
      default: {},
      utila: {
        background: `${utilaPalette.primaryBlue}14`,
        border: `1px solid ${utilaPalette.primaryBlue}`,
        selectors: {
          "&:hover": {
            background: `${utilaPalette.primaryBlue}14`,
          },
        },
      },
    },
  },
  defaultVariants: {
    variant: "default",
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
        marginRight: "2",
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
