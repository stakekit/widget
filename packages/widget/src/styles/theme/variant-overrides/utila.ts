import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";

export const utilaThemeOverrides: RecursivePartial<typeof lightTheme> = {
  space: {
    buttonMinHeight: "40px",
  },
  borderRadius: {
    baseContract: {
      primaryButton: "8px",
    },
  },
  color: {
    backgroundMuted: vars.color.__internal__utila__grey__one__,
    stakeSectionBackground: vars.color.__internal__utila__grey__one__,
    tokenSelectBackground: vars.color.__internal__utila__grey__one__,
    dashboardDetailsSectionBackground:
      vars.color.__internal__utila__grey__one__,

    primaryButtonBackground: vars.color.__internal__utila__primary__blue__,
    primaryButtonColor: vars.color.white,
    primaryButtonOutline: vars.color.__internal__utila__primary__blue__,

    primaryButtonHoverBackground:
      vars.color.__internal__utila__primary__blue__hover__,
    primaryButtonHoverOutline:
      vars.color.__internal__utila__primary__blue__hover__,

    primaryButtonActiveBackground:
      vars.color.__internal__utila__primary__blue__active__,
    primaryButtonActiveOutline:
      vars.color.__internal__utila__primary__blue__active__,
  },
};
