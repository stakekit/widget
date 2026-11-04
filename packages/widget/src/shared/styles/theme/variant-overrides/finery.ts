import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";
import {
  fineryDarkPalette,
  fineryLightPalette,
  utilaPalette,
} from "./palettes";

const fineryPalettes = {
  light: fineryLightPalette,
  dark: fineryDarkPalette,
} as const;

/** Finery's legacy overrides in the resolved color scheme. */
export const getFineryThemeOverrides = (
  colorScheme: "light" | "dark"
): RecursivePartial<typeof lightTheme> => {
  const palette = fineryPalettes[colorScheme];

  return {
    color: {
      background: palette.greyOne,
      summaryItemBackground: palette.summaryItemBackground,
      stakeSectionBackground: palette.greyTwo,
      modalBodyBackground: palette.greyOne,
      tokenSelectBackground: palette.greyTwo,
      tokenSelectHoverBackground: palette.greyThree,
      backgroundMuted: palette.greyTwo,

      summaryLabelStakedBackground: palette.purpleOne,
      summaryLabelStakedColor: palette.purpleTwo,
      summaryLabelApyBackground: palette.blueOne,
      summaryLabelApyColor: palette.blueTwo,
      summaryLabelAvailableBackground: palette.greenThree,
      summaryLabelAvailableColor: palette.greenOne,

      smallButtonBackground: palette.greyTwo,
      smallButtonColor: vars.color.white,

      primaryButtonBackground: palette.greenOne,
      primaryButtonColor: vars.color.white,

      secondaryButtonBackground: palette.greyTwo,
      secondaryButtonColor: vars.color.text,

      positionsClaimRewardsBackground: utilaPalette.badgeTextSuccess,

      skeletonLoaderBase: palette.greyTwo,
      skeletonLoaderHighlight: palette.greyThree,
    },
  };
};
