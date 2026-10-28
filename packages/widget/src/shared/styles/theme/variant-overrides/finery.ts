import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import { darkTheme, type lightTheme } from "../themes";
import {
  fineryDarkPalette,
  fineryLightPalette,
  utilaPalette,
} from "./palettes";

/** The only base-theme value the Finery overrides depend on. */
export type FineryBaseTheme = {
  readonly color: Pick<(typeof lightTheme)["color"], "primary">;
};

const getFineryPalette = (theme: FineryBaseTheme) =>
  theme.color.primary === darkTheme.color.primary
    ? fineryDarkPalette
    : fineryLightPalette;

export const getFineryThemeOverrides = (
  theme: FineryBaseTheme
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
