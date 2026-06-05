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
        borderRadius: "8px",
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

export const outletWrapper = recipe({
  variants: {
    variant: {
      default: {
        padding: "18px",
      },
      utila: {
        padding: "18px",
      },
      porto: {
        padding: "18px",
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
