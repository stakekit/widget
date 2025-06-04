import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const wrapper = style([
  atoms({
    background: "background",
    borderColor: "backgroundMuted",
  }),
  {
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "30px",
    boxShadow: "0px 15px 40px 0px #0000000D",
    width: "1000px",
  },
]);

export const outletWrapper = recipe({
  variants: {
    variant: {
      default: {
        paddingTop: "24px",
        paddingLeft: "30px",
        paddingRight: "30px",
        paddingBottom: "24px",
      },
      utila: {
        padding: "24px",
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
  },
});

export const tabPageDivider = recipe({
  base: {
    alignSelf: "stretch",
    width: "1px",
  },
  variants: {
    variant: {
      default: [
        atoms({
          background: "backgroundMuted",
        }),
      ],
      utila: [
        atoms({
          background: "__internal__utila__tabPageDivider",
        }),
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
