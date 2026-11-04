import { useAtomValue } from "@effect/atom-react";
import { assignInlineVars } from "@vanilla-extract/dynamic";
import { Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { ComponentProps, PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type {
  WidgetAppearance,
  WidgetConfig,
  WidgetLayout,
} from "../../../services/config/widget-config-model";
import { mergeDeep } from "../../../shared/effect/merge-deep";
import { vars } from "../../../shared/styles/theme/contract.css";
import { id, rootSelector } from "../../../shared/styles/theme/ids";
import { darkTheme, lightTheme } from "../../../shared/styles/theme/themes";
import {
  type FineryBaseTheme,
  getFineryThemeOverrides,
} from "../../../shared/styles/theme/variant-overrides/finery";
import { portoThemeOverrides } from "../../../shared/styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../../../shared/styles/theme/variant-overrides/utila";
import type { RecursivePartial } from "../../../shared/types/utils";
import {
  type CallToActionSize,
  type ColorRole,
  type ColorScheme,
  ThemeRoot,
} from "../../../ui/composition";
import { preferredColorSchemeAtom } from "../../runtime/color-scheme-runtime";

/** The legacy theme each color scheme starts from. */
const legacyBaseThemes = { light: lightTheme, dark: darkTheme } as const;

/** The call-to-action size each Layout presents. */
const callToActionSizes: Readonly<Record<WidgetLayout, CallToActionSize>> = {
  Compact: "lg",
  Dashboard: "md",
};

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

export const getThemeOverrides = ({
  baseTheme,
  variant,
}: {
  baseTheme: FineryBaseTheme;
  variant: WidgetConfig["variant"];
}): RecursivePartial<typeof lightTheme> => {
  if (variant === "utila") {
    return utilaThemeOverrides;
  }

  if (variant === "finery") {
    return getFineryThemeOverrides(baseTheme);
  }

  if (variant === "porto") {
    return portoThemeOverrides;
  }

  return {};
};

/**
 * CSS variable assignments for a merged theme, read through the theme
 * contract: each contract leaf (a `var(--…)` reference) takes the merged value
 * at the same path. Values off the contract are not emitted.
 */
const themeVarEntries = (
  contract: unknown,
  tokens: unknown
): ReadonlyArray<readonly [string, string]> => {
  if (typeof contract === "string") {
    return typeof tokens === "string" ? [[contract, tokens]] : [];
  }
  if (!Predicate.isObject(contract) || !Predicate.isObject(tokens)) return [];

  return Object.entries(contract).flatMap(([key, node]) =>
    themeVarEntries(node, tokens[key])
  );
};

/**
 * Theme variables for a host theme and variant, read from props, and the
 * Design System's theme root for the Layout's presentation and the host's
 * Appearance. A `system` color scheme follows the operating system live.
 * The legacy variables start from the resolved scheme's legacy theme, so
 * screens not yet on the Design System match it.
 */
export const ThemeStyles = ({
  appearance,
  children,
  layout,
  portalContainer,
  theme,
  variant,
}: PropsWithChildren<{
  readonly appearance: ConformingAppearance;
  readonly layout: WidgetLayout;
  readonly portalContainer: HTMLElement | undefined;
  readonly theme: WidgetConfig["theme"];
  readonly variant: WidgetConfig["variant"];
}>) => {
  const colorScheme = useAtomValue(
    resolvedColorSchemeAtom(appearance.colorScheme)
  );
  const baseTheme = legacyBaseThemes[colorScheme];
  const overrides = getThemeOverrides({
    baseTheme: {
      color: { primary: theme?.color?.primary ?? baseTheme.color.primary },
    },
    variant,
  });
  const finalTheme = mergeDeep(baseTheme, theme, overrides);
  const themeVars = Object.fromEntries(themeVarEntries(vars, finalTheme));

  return (
    <div data-rk={id}>
      <style
        // biome-ignore lint: false
        dangerouslySetInnerHTML={{
          __html: `${rootSelector} {${assignInlineVars(themeVars)}}`,
        }}
      />
      <ThemeRoot
        appearance={appearance}
        // Host Profiles name no Appearance Preset yet.
        appearancePreset="default"
        callToActionSize={callToActionSizes[layout]}
        colorScheme={colorScheme}
        portalContainer={portalContainer}
      >
        {children}
      </ThemeRoot>
    </div>
  );
};

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const appearance = useWidgetConfig("appearance");
  const layout = useWidgetConfig("layout");
  const portalContainer = useWidgetConfig("portalContainer");
  const theme = useWidgetConfig("theme");
  const variant = useWidgetConfig("variant");

  return (
    <ThemeStyles
      appearance={appearance}
      layout={layout}
      portalContainer={portalContainer}
      theme={theme}
      variant={variant}
    >
      {children}
    </ThemeStyles>
  );
};
