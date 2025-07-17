import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../styles/theme/atoms.css";

export const divider = style({
  position: "absolute",
  width: "100%",
  bottom: 0,
});

export const tab = recipe({
  base: {
    cursor: "pointer",
    userSelect: "none",
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  variants: {
    variant: {
      utila: [
        {
          borderRadius: "8px",
          padding: "8px 16px",
        },
      ],
    },
    state: {
      active: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        state: "active",
        variant: "utila",
      },
      style: [atoms({ background: "__internal__utila__grey__one__" })],
    },
  ],
});

export const tabBorder = style([
  atoms({
    background: "tabBorder",
    borderRadius: "full",
    position: "absolute",
  }),
  {
    bottom: 0,
    left: 0,
    right: 0,
    height: "2.5px",
  },
]);

export const tabContainer = recipe({
  base: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    height: "80px",
  },
  variants: {
    variant: {
      default: {
        width: "200px",
      },
      utila: {
        height: "32px",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const tabText = recipe({
  base: {
    fontWeight: "500",
    fontSize: "16px",
    lineHeight: "125%",
    textAlign: "center",
  },
  variants: {
    variant: {
      utila: [
        atoms({ fontWeight: "semibold" }),
        {
          fontSize: "14px",
        },
      ],
    },
  },
});

export const tabsContainer = recipe({
  base: [
    atoms({
      zIndex: "simple",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    {
      gap: "24px",
    },
  ],
  variants: {
    variant: {
      utila: {
        gap: "15px",
        padding: "8px",
        paddingLeft: "24px",
        paddingRight: "24px",
      },
    },
  },
});

export const headerContainer = style([
  atoms({
    paddingTop: "4",
  }),
  {
    paddingRight: "40px",
    paddingLeft: "40px",
    display: "grid",
    gridTemplateColumns: "1fr 3fr 1fr",
  },
]);

export const middleItem = style({
  gridColumn: "2",
});

export const tabsWrapper = recipe({
  base: {
    position: "relative",
    display: "flex",
  },
  variants: {
    variant: {
      default: {
        justifyContent: "center",
      },
      utila: {
        justifyContent: "flex-start",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
