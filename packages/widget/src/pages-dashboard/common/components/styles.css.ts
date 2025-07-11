import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

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
        borderRadius: "8px",
      },
    },
  },
});

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
    justifyContent: "center",
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
