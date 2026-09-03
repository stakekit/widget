import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { DASHBOARD_OUTLET_PADDING } from "../../../../shared/styles/tokens/layout";

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
      maxWidth: "1000px",
      width: "100%",
      minWidth: "100%",
    },
  ],
  variants: {
    variant: {
      default: {
        borderRadius: "14px",
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

export const headerContainer = style([
  atoms({ paddingTop: "4" }),
  {
    display: "grid",
    gridTemplateColumns: "1fr 3fr 1fr",
    paddingLeft: "40px",
    paddingRight: "40px",
  },
]);

export const middleItem = style({ gridColumn: "2" });

export const disconnectButton = style({
  alignSelf: "center",
  height: "24px",
  justifySelf: "end",
  width: "24px",
});

/**
 * Horizontal inset applied by the dashboard outlet wrapper. Scroll containers
 * that want their scrollbar to sit in the edge zone (instead of crowding
 * content) bleed past this value and re-apply it as inner padding, so this is
 * the single source of truth both sides must reference.
 */
export const outletWrapper = recipe({
  variants: {
    variant: {
      default: {
        padding: DASHBOARD_OUTLET_PADDING,
      },
      utila: {
        padding: DASHBOARD_OUTLET_PADDING,
      },
      porto: {
        padding: DASHBOARD_OUTLET_PADDING,
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
