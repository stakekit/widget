import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";

export const fineryThemeOverrides: RecursivePartial<typeof lightTheme> = {
  color: {
    background: vars.color.__internal__finery__grey__one__,
    stakeSectionBackground: vars.color.__internal__finery__grey__two__,
    modalBodyBackground: vars.color.__internal__finery__grey__one__,
    tokenSelectBackground: vars.color.__internal__finery__grey__two__,
    tokenSelectHoverBackground: vars.color.__internal__finery__grey__three__,
    backgroundMuted: vars.color.__internal__finery__grey__two__,

    smallButtonBackground: vars.color.__internal__finery__grey__two__,
    smallButtonOutline: vars.color.__internal__finery__grey__two__,
    smallButtonHoverBackground: vars.color.__internal__finery__grey__three__,
    smallButtonHoverOutline: vars.color.__internal__finery__grey__three__,
    smallButtonColor: vars.color.white,
    smallButtonHoverColor: vars.color.white,
    smallButtonActiveColor: vars.color.white,

    primaryButtonBackground: vars.color.__internal__finery__green__one__,
    primaryButtonOutline: vars.color.__internal__finery__green__one__,
    primaryButtonHoverBackground: vars.color.__internal__finery__green__two__,
    primaryButtonHoverOutline: vars.color.__internal__finery__green__two__,
    primaryButtonActiveBackground: vars.color.__internal__finery__green__two__,
    primaryButtonActiveOutline: vars.color.__internal__finery__green__two__,
    primaryButtonColor: vars.color.white,
    primaryButtonActiveColor: vars.color.white,
    primaryButtonHoverColor: vars.color.white,

    secondaryButtonBackground: vars.color.__internal__finery__grey__two__,
    secondaryButtonOutline: vars.color.__internal__finery__grey__two__,
    secondaryButtonHoverBackground:
      vars.color.__internal__finery__grey__three__,
    secondaryButtonHoverOutline: vars.color.__internal__finery__grey__three__,
    secondaryButtonActiveBackground:
      vars.color.__internal__finery__grey__three__,
    secondaryButtonActiveOutline: vars.color.__internal__finery__grey__three__,
    secondaryButtonColor: vars.color.text,

    connectKit: {
      modalBackground: vars.color.__internal__finery__grey__one__,
      profileForeground: vars.color.__internal__finery__grey__one__,
      profileAction: vars.color.__internal__finery__grey__two__,
      profileActionHover: vars.color.__internal__finery__grey__three__,
    },

    positionsClaimRewardsBackground:
      vars.color.__internal__utila__badge__text__success__,

    skeletonLoaderBase: vars.color.__internal__finery__grey__two__,
    skeletonLoaderHighlight: vars.color.__internal__finery__grey__three__,
  },
};
