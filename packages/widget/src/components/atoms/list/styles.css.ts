import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { vars } from "@sk-widget/styles/theme/contract.css";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";

export const itemContainer = recipe({
  base: [
    atoms({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      px: { tablet: "4", mobile: "3" },
      py: "3",
      borderRadius: "xl",
      flex: 1,
      background: "tokenSelectBackground",
    }),
  ],
  variants: {
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
    hover: "enabled",
    type: "enabled",
  },
});

export type ItemContainerVariants = RecipeVariants<typeof itemContainer>;
