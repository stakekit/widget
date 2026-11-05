import "./reset.css";
import * as stylex from "@stylexjs/stylex";
import type { PropsWithChildren } from "react";
import {
  callToAction,
  gutter as gutterVars,
  presentationMarker,
} from "../tokens/presentation.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { type Appearance, appearanceProperties } from "./appearance";
import {
  type AppearancePreset,
  appearancePresetThemes,
  presetColorScheme,
  resolveColorRoles,
} from "./appearance-presets";
import { type ColorScheme, colorSchemeThemes } from "./color-schemes";
import { PortalContainerProvider } from "./portal-container";

/** The call-to-action height: the `md` or `lg` control height. */
type CallToActionSize = "md" | "lg";

/** The gap between a page's sections and its edge: 16 (`md`) or 20 (`lg`). */
type GutterSize = "md" | "lg";

/** How the selected tab is marked: a line under it or a filled pill. */
export type TabsIndicator = "underline" | "pill";

/** Whether surfaces sit on the canvas as fills or lift off it with a shadow. */
export type SurfaceStyle = "filled" | "elevated";

/** Every Presentation Setting the theme root applies. */
export type PresentationSettings = Readonly<{
  callToActionSize: CallToActionSize;
  gutter: GutterSize;
  surfaceStyle: SurfaceStyle;
  tabsIndicator: TabsIndicator;
}>;

// One theme per setting's value, over that setting's own variables, so the
// settings compose. Each is declared on the theme root, so a preset's or
// host's `controlHeight` set there reaches the call to action: a variable
// default referencing another variable resolves once, at `:root`.
const mediumCallToAction = stylex.createTheme(callToAction, {
  height: controlHeight.md,
});

const largeCallToAction = stylex.createTheme(callToAction, {
  height: controlHeight.lg,
});

const mediumGutter = stylex.createTheme(gutterVars, { size: space[16] });

const largeGutter = stylex.createTheme(gutterVars, { size: space[20] });

const callToActionThemes = { md: mediumCallToAction, lg: largeCallToAction };

const gutterThemes = { md: mediumGutter, lg: largeGutter };

// The Widget root only, not a host portal container: a stacking context of
// its own. An inline root generates no box, so content placed in a host's
// text or flex row keeps its own size and place there.
const rootStyles = stylex.create({
  root: { isolation: "isolate" },
  inline: { display: "contents" },
});

/**
 * Applies the Design System's theme for a color scheme, Appearance Preset and
 * Presentation Settings to the Widget root it renders and to the portal
 * container, so popups rendered outside the root carry the same Color Roles
 * and settings. A preset that fixes the color scheme overrides the requested
 * one. A host's Appearance is set over them as inline custom properties on
 * both. It sets no color, font or spacing on the root itself: Text roles
 * carry the font, and each part its own colors and spacing.
 *
 * Value settings (call-to-action size, gutter) are themes over their own
 * variable groups; the tabs indicator and surface style are attributes
 * components read through `presentationMarker`.
 *
 * `inline` themes standalone content placed in a host's own layout, such as a
 * single trigger in a footer row: the root and its content generate no box
 * and are no size container, so the content sizes and flows as if unwrapped.
 */
export const ThemeRoot = ({
  appearance,
  appearancePreset,
  callToActionSize,
  children,
  colorScheme: requestedColorScheme,
  gutter,
  inline = false,
  portalContainer,
  surfaceStyle,
  tabsIndicator,
}: PropsWithChildren<
  PresentationSettings & {
    readonly appearance: Appearance;
    readonly appearancePreset: AppearancePreset;
    /** The scheme the host requests; a preset may fix another. */
    readonly colorScheme: ColorScheme;
    /** Themes content placed in a host's own layout without a box of its own. */
    readonly inline?: boolean;
    readonly portalContainer: HTMLElement | undefined;
  }
>) => {
  const colorScheme = presetColorScheme(appearancePreset, requestedColorScheme);
  const { className: themeClassName = "" } = stylex.props(
    colorSchemeThemes[colorScheme],
    appearancePresetThemes(appearancePreset, colorScheme),
    callToActionThemes[callToActionSize],
    gutterThemes[gutter],
    presentationMarker
  );
  const { className: rootClassName = "" } = stylex.props(
    inline ? rootStyles.inline : rootStyles.root
  );
  const properties = appearanceProperties(
    { requested: requestedColorScheme, presented: colorScheme },
    resolveColorRoles(colorScheme, appearancePreset),
    appearance
  );
  const attributes = {
    "data-sk-surface-style": surfaceStyle,
    "data-sk-tabs-indicator": tabsIndicator,
  };

  return (
    <div
      data-sk-root=""
      {...attributes}
      className={`${themeClassName} ${rootClassName}`}
      style={properties}
    >
      <PortalContainerProvider
        hostContainer={portalContainer}
        inline={inline}
        themeAttributes={attributes}
        themeClassName={themeClassName}
        themeProperties={properties}
      >
        {children}
      </PortalContainerProvider>
    </div>
  );
};
