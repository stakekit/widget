import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { utilaPalette } from "../../../styles/theme/variant-overrides/palettes";

export const wrapper = recipe({
  base: [
    atoms({
      background: "background",
      borderColor: "backgroundMuted",
    }),
    {
      borderWidth: "1px",
      borderStyle: "solid",
      boxShadow: "0px 15px 40px 0px #0000000D",
      width: "1000px",
    },
  ],
  variants: {
    variant: {
      default: {
        borderRadius: "30px",
      },
      utila: {
        borderRadius: "14px",
      },
      finery: {
        borderRadius: "30px",
      },
      porto: {
        borderRadius: "8px",
      },
    },
  },
});

/**
 * Horizontal inset applied by the dashboard outlet wrapper. Scroll containers
 * that want their scrollbar to sit in the edge zone (instead of crowding
 * content) bleed past this value and re-apply it as inner padding, so this is
 * the single source of truth both sides must reference.
 */
export const OUTLET_PADDING = "18px";

export const outletWrapper = recipe({
  variants: {
    variant: {
      default: {
        padding: OUTLET_PADDING,
      },
      utila: {
        padding: OUTLET_PADDING,
      },
      porto: {
        padding: OUTLET_PADDING,
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const tabPageContainer = recipe({
  base: {
    display: "flex",
    flexDirection: "row",
    gap: "24px",
    alignItems: "stretch",
    justifyContent: "center",
  },
});

export const tabPageDivider = recipe({
  base: {
    alignSelf: "stretch",
    width: "1px",
    marginTop: "-18px",
  },
  variants: {
    variant: {
      default: [
        atoms({
          background: "backgroundMuted",
        }),
      ],
      utila: [
        {
          background: utilaPalette.tabPageDivider,
        },
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
