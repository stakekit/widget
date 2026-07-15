import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const itemContainer = recipe({
  base: [
    atoms({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      px: "3",
      py: "3",
      borderRadius: "xl",
      flex: 1,
    }),
  ],
  variants: {
    appearance: {
      card: atoms({ background: "tokenSelectBackground" }),
      plain: [
        atoms({ background: "transparent" }),
        { border: "1px solid transparent", boxSizing: "border-box" },
      ],
    },
    hover: {
      disabled: {},
      enabled: {
        cursor: "pointer",
        ":hover": {
          background: vars.color.tokenSelectHoverBackground,
        },
      },
    },
    type: {
      disabled: { opacity: 0.5 },
      enabled: { opacity: 1 },
    },
  },
  defaultVariants: {
    appearance: "card",
    hover: "enabled",
    type: "enabled",
  },
});

export type ItemContainerVariants = RecipeVariants<typeof itemContainer>;
