import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";

export const portoThemeOverrides: RecursivePartial<typeof lightTheme> = {
  space: {
    buttonMinHeight: "40px",
  },
  borderRadius: {
    baseContract: {
      xl: "8px",
      primaryButton: "8px",
      secondaryButton: "8px",
    },
  },
  fontWeight: {
    normal: "300",
    medium: "400",
    semibold: "500",
    bold: "600",
    extrabold: "700",

    modalHeading: "500",
    tokenSelect: "600",
    primaryButton: "600",
    secondaryButton: "600",
  },
  color: {
    tooltipBackground: vars.color.__internal__porto__grey__three__,
    summaryItemBackground: vars.color.__internal__porto__grey__two__,
    background: vars.color.__internal__porto__grey__one__,
    backgroundMuted: vars.color.__internal__porto__grey__three__,
    stakeSectionBackground: vars.color.__internal__porto__grey__two__,
    tokenSelectBackground: vars.color.__internal__porto__grey__two__,
    tokenSelectHoverBackground: vars.color.__internal__porto__grey__three__,
    dashboardDetailsSectionBackground:
      vars.color.__internal__porto__grey__two__,

    modalBodyBackground: vars.color.__internal__porto__grey__one__,

    skeletonLoaderBase: vars.color.__internal__porto__grey__two__,
    skeletonLoaderHighlight: vars.color.__internal__porto__grey__three__,

    primaryButtonBackground: vars.color.__internal__porto__primary__purple__,
    primaryButtonColor: vars.color.white,
    primaryButtonHoverColor: vars.color.white,
    primaryButtonActiveColor: vars.color.white,
    primaryButtonOutline: vars.color.__internal__porto__primary__purple__,

    smallButtonBackground: vars.color.__internal__porto__grey__three__,

    primaryButtonHoverBackground:
      vars.color.__internal__porto__primary__purple__hover__,
    primaryButtonHoverOutline:
      vars.color.__internal__porto__primary__purple__hover__,

    primaryButtonActiveBackground:
      vars.color.__internal__porto__primary__purple__active__,
    primaryButtonActiveOutline:
      vars.color.__internal__porto__primary__purple__active__,

    connectKit: {
      modalBackground: vars.color.__internal__porto__grey__one__,
      profileForeground: vars.color.__internal__porto__grey__one__,
      profileAction: vars.color.__internal__porto__grey__two__,
      profileActionHover: vars.color.__internal__porto__grey__three__,
    },
  },
};
