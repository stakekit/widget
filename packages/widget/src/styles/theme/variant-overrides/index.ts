import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";

export const utilaLightThemeOverrides: RecursivePartial<typeof lightTheme> = {
  space: {
    buttonMinHeight: "40px",
  },
  borderRadius: {
    baseContract: {
      primaryButton: "8px",
    },
  },
  color: {
    backgroundMuted: vars.color.__internal__utila__greyOne,
    stakeSectionBackground: vars.color.__internal__utila__greyOne,
    tokenSelectBackground: vars.color.__internal__utila__greyOne,
    dashboardDetailsSectionBackground: vars.color.__internal__utila__greyOne,

    primaryButtonBackground: vars.color.__internal__utila__primaryBlue,
    primaryButtonColor: vars.color.white,
    primaryButtonOutline: vars.color.__internal__utila__primaryBlue,

    primaryButtonHoverBackground:
      vars.color.__internal__utila__primaryBlueHover,
    primaryButtonHoverOutline: vars.color.__internal__utila__primaryBlueHover,

    primaryButtonActiveBackground:
      vars.color.__internal__utila__primaryBlueActive,
    primaryButtonActiveOutline: vars.color.__internal__utila__primaryBlueActive,
  },
};
