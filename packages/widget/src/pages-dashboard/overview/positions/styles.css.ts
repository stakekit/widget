import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const listItemContainer = recipe({
  base: [atoms({ borderRadius: "base" }), { padding: "2px 4px" }],

  variants: {
    type: {
      claim: atoms({ background: "positionsClaimRewardsBackground" }),
      actionRequired: atoms({
        background: "positionsActionRequiredBackground",
      }),
      pending: atoms({ background: "positionsPendingBackground" }),
    },
  },
});

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});

export const container = style({
  minHeight: "300px",
  height: "100%",
});

export const sectionHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

export const sectionTitle = style({
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const positionsTitle = recipe({
  variants: {
    variant: {
      default: atoms({
        fontSize: "md",
      }),
      utila: {
        fontSize: "16px",
      },
      finery: {},
      porto: {
        fontSize: "16px",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
