import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import type { ComponentProps, PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type { HostProfile } from "../../../services/config/host-profile";
import type {
  WidgetAppearance,
  WidgetLayout,
} from "../../../services/config/widget-config-model";
import {
  type ColorRole,
  type ColorScheme,
  type PresentationSettings,
  ThemeRoot,
} from "../../../ui/composition";
import { preferredColorSchemeAtom } from "../../runtime/color-scheme-runtime";

/**
 * Each Layout's Presentation Settings, before the Host Profile's overrides.
 * The Design System names the settings after the difference, never the Layout.
 */
const layoutPresentation: Readonly<Record<WidgetLayout, PresentationSettings>> =
  {
    Compact: {
      callToActionSize: "lg",
      gutter: "md",
      surfaceStyle: "filled",
      tabsIndicator: "underline",
    },
    Dashboard: {
      callToActionSize: "md",
      gutter: "lg",
      surfaceStyle: "filled",
      tabsIndicator: "pill",
    },
  };

/** The Host Profile's part in the Widget's look. */
type HostLook = Pick<HostProfile, "appearancePreset" | "presentation">;

type DesignSystemAppearance = ComponentProps<typeof ThemeRoot>["appearance"];

type GroupKeys<Group> = keyof NonNullable<Group>;

type SameKeys<Host, DesignSystem> = [Host] extends [DesignSystem]
  ? [DesignSystem] extends [Host]
    ? true
    : false
  : false;

type AppearanceGroup = "radius" | "controlHeight" | "font" | "fontWeight";

type GroupsConform = {
  readonly [Group in AppearanceGroup]: SameKeys<
    GroupKeys<WidgetAppearance[Group]>,
    GroupKeys<DesignSystemAppearance[Group]>
  >;
}[AppearanceGroup];

/** The Color Roles Widget Configuration carries, keyed by the host's roles. */
type WidgetColorRole = keyof WidgetAppearance["colors"]["light"];

/**
 * The host's Appearance, which the theme root takes as is. Compile-time
 * conformance: it is `never`, so no caller compiles, unless the Color Roles
 * Widget Configuration carries (the public `SKColorRole`s) are exactly the
 * Design System's Color Roles and every other group has exactly the Design
 * System's keys. Assignability alone would let a renamed or added role drop
 * the host's value silently.
 */
type ConformingAppearance = [
  SameKeys<WidgetColorRole, ColorRole>,
  GroupsConform,
] extends [true, true]
  ? WidgetAppearance
  : never;

/**
 * The color scheme a host's choice resolves to. Only `system` reads the OS
 * preference, so a fixed scheme never subscribes to it.
 */
const resolvedColorSchemeAtom = Atom.family(
  (choice: WidgetAppearance["colorScheme"]) =>
    Atom.make(
      (get): ColorScheme =>
        choice === "system" ? get(preferredColorSchemeAtom) : choice
    ).pipe(Atom.withLabel("resolvedColorSchemeAtom"))
);

/**
 * The Design System's theme root for the Host Profile's Appearance Preset,
 * the Presentation Settings (the Layout's defaults under the Host Profile's
 * overrides) and the host's Appearance, which already carries any legacy
 * `theme` mapped into it. A `system` color scheme follows the operating
 * system live, unless the preset fixes the scheme.
 */
export const ThemeStyles = ({
  appearance,
  children,
  hostLook,
  inline = false,
  layout,
  portalContainer,
}: PropsWithChildren<{
  readonly appearance: ConformingAppearance;
  readonly hostLook: HostLook;
  /** Themes content placed in the host's own layout, without a box. */
  readonly inline?: boolean;
  readonly layout: WidgetLayout;
  readonly portalContainer: HTMLElement | undefined;
}>) => {
  const requestedColorScheme = useAtomValue(
    resolvedColorSchemeAtom(appearance.colorScheme)
  );
  const presentation: PresentationSettings = {
    ...layoutPresentation[layout],
    ...hostLook.presentation,
  };

  return (
    <ThemeRoot
      appearance={appearance}
      appearancePreset={hostLook.appearancePreset}
      callToActionSize={presentation.callToActionSize}
      colorScheme={requestedColorScheme}
      gutter={presentation.gutter}
      inline={inline}
      portalContainer={portalContainer}
      surfaceStyle={presentation.surfaceStyle}
      tabsIndicator={presentation.tabsIndicator}
    >
      {children}
    </ThemeRoot>
  );
};

/**
 * The theme root for Widget Configuration. `inline` themes standalone content
 * in the host's own layout, such as a `HelpModal` among `SKApp` children.
 */
export const ThemeWrapper = ({
  children,
  inline = false,
}: PropsWithChildren<{ readonly inline?: boolean }>) => {
  const appearance = useWidgetConfig("appearance");
  const hostProfile = useWidgetConfig("hostProfile");
  const layout = useWidgetConfig("layout");
  const portalContainer = useWidgetConfig("portalContainer");

  return (
    <ThemeStyles
      appearance={appearance}
      hostLook={hostProfile}
      inline={inline}
      layout={layout}
      portalContainer={portalContainer}
    >
      {children}
    </ThemeStyles>
  );
};
