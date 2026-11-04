import "./reset.css";
import * as stylex from "@stylexjs/stylex";
import type { PropsWithChildren } from "react";
import { presentation } from "../tokens/presentation.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { type Appearance, appearanceProperties } from "./appearance";
import {
  type AppearancePreset,
  appearancePresetThemes,
  resolveColorRoles,
} from "./appearance-presets";
import { type ColorScheme, colorSchemeThemes } from "./color-schemes";
import { PortalContainerProvider } from "./portal-container";

/** The call-to-action height a Layout asks for. */
export type CallToActionSize = "md" | "lg";

const mediumCallToAction = stylex.createTheme(presentation, {
  callToActionHeight: controlHeight.md,
});

const largeCallToAction = stylex.createTheme(presentation, {
  callToActionHeight: controlHeight.lg,
});

// Each size is declared on the theme root, so a preset's or host's
// `controlHeight` set there reaches the call to action: a variable default
// referencing another variable resolves once, at `:root`.
const callToActionThemes = { md: mediumCallToAction, lg: largeCallToAction };

// The Widget root only, not a host portal container: a stacking context of
// its own.
const rootStyles = stylex.create({
  root: { isolation: "isolate" },
});

/**
 * Applies the Design System's theme for a color scheme, Appearance Preset and
 * presentation to the Widget root it renders and to the portal container, so
 * popups rendered outside the root carry the same Color Roles. A host's
 * Appearance is set over them as inline custom properties on both. It sets
 * no color, font or spacing on the root itself: screens that have not moved
 * to the Design System keep their own styles.
 */
export const ThemeRoot = ({
  appearance,
  appearancePreset,
  callToActionSize,
  children,
  colorScheme,
  portalContainer,
}: PropsWithChildren<{
  readonly appearance: Appearance;
  readonly appearancePreset: AppearancePreset;
  readonly callToActionSize: CallToActionSize;
  readonly colorScheme: ColorScheme;
  readonly portalContainer: HTMLElement | undefined;
}>) => {
  const { className: themeClassName = "" } = stylex.props(
    colorSchemeThemes[colorScheme],
    appearancePresetThemes(appearancePreset, colorScheme),
    callToActionThemes[callToActionSize]
  );
  const { className: rootClassName = "" } = stylex.props(rootStyles.root);
  const properties = appearanceProperties(
    colorScheme,
    resolveColorRoles(colorScheme, appearancePreset),
    appearance
  );

  return (
    <div
      data-sk-root=""
      className={`${themeClassName} ${rootClassName}`}
      style={properties}
    >
      <PortalContainerProvider
        hostContainer={portalContainer}
        themeClassName={themeClassName}
        themeProperties={properties}
      >
        {children}
      </PortalContainerProvider>
    </div>
  );
};
