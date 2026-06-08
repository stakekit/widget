import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import { darkTheme, type lightTheme } from "../themes";
import {
  fineryDarkPalette,
  fineryLightPalette,
  utilaPalette,
} from "./palettes";

const getFineryPalette = (theme: typeof lightTheme) =>
  theme.color.background === darkTheme.color.background
    ? fineryDarkPalette
    : fineryLightPalette;

export const getFineryThemeOverrides = (
  theme: typeof lightTheme
): RecursivePartial<typeof lightTheme> => {
  const palette = getFineryPalette(theme);

  return {
    color: {
      background: palette.greyOne,
      summaryItemBackground: palette.summaryItemBackground,
      stakeSectionBackground: palette.greyTwo,
      modalBodyBackground: palette.greyOne,
      tokenSelectBackground: palette.greyTwo,
      tokenSelectHoverBackground: palette.greyThree,
      backgroundMuted: palette.greyTwo,

      smallButtonBackground: palette.greyTwo,
      smallButtonColor: vars.color.white,

      primaryButtonBackground: palette.greenOne,
      primaryButtonColor: vars.color.white,

      secondaryButtonBackground: palette.greyTwo,
      secondaryButtonColor: vars.color.text,

      connectKit: {
        modalBackground: palette.greyOne,
        profileForeground: palette.greyOne,
        profileAction: palette.greyTwo,
        profileActionHover: palette.greyThree,
      },

      positionsClaimRewardsBackground: utilaPalette.badgeTextSuccess,

      skeletonLoaderBase: palette.greyTwo,
      skeletonLoaderHighlight: palette.greyThree,
    },
  };
};
