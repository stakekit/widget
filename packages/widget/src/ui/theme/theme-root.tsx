import "./reset.css";
import * as stylex from "@stylexjs/stylex";
import { type PropsWithChildren, useLayoutEffect } from "react";
import { presentation } from "../tokens/presentation.stylex";
import { controlHeight } from "../tokens/size.stylex";
import {
  type AppearancePreset,
  appearancePresetThemes,
} from "./appearance-presets";
import { type ColorScheme, colorSchemeThemes } from "./color-schemes";

/** The call-to-action height a Layout asks for. */
export type CallToActionSize = "md" | "lg";

const mediumCallToAction = stylex.createTheme(presentation, {
  callToActionHeight: controlHeight.md,
});

// `lg` is the presentation default.
const callToActionThemes = { md: mediumCallToAction, lg: null };

/** Marks a portal container for the scoped reset (`reset.css`). */
const portalAttribute = "data-sk-portal";

/**
 * Applies the Design System's theme for a color scheme, Appearance Preset and
 * presentation to the Widget root it renders and to the portal container, so
 * popups rendered outside the root carry the same Color Roles. It sets no
 * visual property on the root itself: screens that have not moved to the
 * Design System keep their own styles.
 */
export const ThemeRoot = ({
  appearancePreset,
  callToActionSize,
  children,
  colorScheme,
  portalContainer,
}: PropsWithChildren<{
  readonly appearancePreset: AppearancePreset;
  readonly callToActionSize: CallToActionSize;
  readonly colorScheme: ColorScheme;
  readonly portalContainer: HTMLElement | undefined;
}>) => {
  const { className = "" } = stylex.props(
    colorSchemeThemes[colorScheme],
    appearancePresetThemes(appearancePreset, colorScheme),
    callToActionThemes[callToActionSize]
  );

  useLayoutEffect(() => {
    if (!portalContainer) return;

    const classNames = className.split(" ").filter(Boolean);
    portalContainer.classList.add(...classNames);
    portalContainer.setAttribute(portalAttribute, "");

    return () => {
      portalContainer.classList.remove(...classNames);
      portalContainer.removeAttribute(portalAttribute);
    };
  }, [className, portalContainer]);

  return (
    <div data-sk-root="" className={className}>
      {children}
    </div>
  );
};
