import { type ColorRole, type ColorRoles, color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { font, fontWeight } from "../tokens/typography.stylex";
import type { ColorScheme } from "./color-schemes";

/**
 * Host-supplied theme values over the color scheme and Appearance Preset:
 * Color Roles per color scheme, radius, control heights, font and weights.
 * Every value is a CSS value.
 */
export type Appearance = Readonly<{
  colors?: Readonly<Partial<Record<ColorScheme, Partial<ColorRoles>>>>;
  radius?: Readonly<
    Partial<Record<"badge" | "control" | "card" | "overlay" | "shell", string>>
  >;
  controlHeight?: Readonly<Partial<Record<"sm" | "md" | "lg", string>>>;
  font?: Readonly<Partial<Record<"sans" | "mono", string>>>;
  fontWeight?: Readonly<
    Partial<Record<"regular" | "medium" | "semibold", string>>
  >;
}>;

const mix = (first: string, percent: number, second: string) =>
  `color-mix(in srgb, ${first} ${percent}%, ${second})`;

// How far each derived role moves from its base. Soft tints sit closer to the
// canvas in light than in dark, matching the defaults.
const softTint = { light: 10, dark: 16 } as const;
const accentHoverWeight = 88;
const accentTextWeight = 60;
const darkFocusRingWeight = 70;

/**
 * Derives the roles a host did not set from the ones it did: the accent's
 * hover, tint, text, focus ring and the informational roles, and each status
 * role's tint. A role is derived only when its base is host-supplied, so the
 * scheme's tuned defaults stay otherwise. `base` is the resolved scheme and
 * preset, which supplies any role the derivation mixes with.
 */
const deriveColorRoles = (
  colorScheme: ColorScheme,
  base: ColorRoles,
  host: Partial<ColorRoles>
): Partial<ColorRoles> => {
  const role = (name: ColorRole) => host[name] ?? base[name];
  const tint = (name: ColorRole) =>
    mix(role(name), softTint[colorScheme], role("background"));
  // Hover deepens the accent in both schemes, so `onAccent` keeps its
  // contrast; the deeper role is the text in light and the canvas in dark.
  const deeper = colorScheme === "light" ? role("text") : role("background");

  const accentRoles = (accent: string): Partial<ColorRoles> => {
    const accentSoft = host.accentSoft ?? tint("accent");
    const accentText =
      host.accentText ?? mix(accent, accentTextWeight, role("text"));
    return {
      accentHover: mix(accent, accentHoverWeight, deeper),
      accentSoft,
      accentText,
      focusRing:
        colorScheme === "light"
          ? accent
          : mix(accent, darkFocusRingWeight, role("text")),
      info: accentText,
      infoSoft: accentSoft,
    };
  };
  const statusTint = (status: "success" | "warning" | "danger") =>
    host[status] === undefined ? {} : { [`${status}Soft`]: tint(status) };

  return {
    ...(host.accent === undefined ? {} : accentRoles(host.accent)),
    ...statusTint("success"),
    ...statusTint("warning"),
    ...statusTint("danger"),
    ...host,
  };
};

/** Every Color Role's value with a host's colors over `base`. */
export const applyHostColors = (
  colorScheme: ColorScheme,
  base: ColorRoles,
  host: Partial<ColorRoles>
): ColorRoles => ({ ...base, ...deriveColorRoles(colorScheme, base, host) });

// A StyleX variable reads `var(--name)`; its custom property is `--name`.
const customProperty = (variable: string) =>
  variable.slice("var(".length, -")".length);

// `NoInfer` keeps the keys from the values, so a StyleX `VarGroup`, whose
// keys include its opaque id and tokens, is read by those keys only.
const groupProperties = <Key extends string>(
  group: Readonly<Record<NoInfer<Key>, string>>,
  values: Readonly<Partial<Record<Key, string>>> | undefined
): ReadonlyArray<readonly [string, string]> => {
  const properties: Array<readonly [string, string]> = [];
  for (const key in values) {
    const variable: string | undefined = group[key];
    const value = values[key];
    if (variable !== undefined && value !== undefined) {
      properties.push([customProperty(variable), value]);
    }
  }
  return properties;
};

/**
 * The custom properties that apply a host's Appearance in a color scheme:
 * its values and the roles derived from them. The theme root sets them
 * inline, over the scheme and preset themes.
 */
export const appearanceProperties = (
  colorScheme: ColorScheme,
  base: ColorRoles,
  appearance: Appearance
): Readonly<Record<string, string>> =>
  Object.fromEntries([
    ...groupProperties(
      color,
      deriveColorRoles(
        colorScheme,
        base,
        appearance.colors?.[colorScheme] ?? {}
      )
    ),
    ...groupProperties(radius, appearance.radius),
    ...groupProperties(controlHeight, appearance.controlHeight),
    ...groupProperties(font, appearance.font),
    ...groupProperties(fontWeight, appearance.fontWeight),
  ]);
