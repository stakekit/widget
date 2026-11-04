import { type ColorRole, type ColorRoles, color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { font, fontWeight } from "../tokens/typography.stylex";
import { type ColorScheme, colorSchemeRoles } from "./color-schemes";
import { contrastRatio, mostContrasting } from "./contrast";

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
const accentTextWeight = 55;
const focusRingWeight = 70;
// WCAG 2.2 1.4.11: a focus ring's contrast on the surface around it.
const focusRingContrast = 3;

/**
 * Derives the roles a host did not set from the ones it did: the accent's
 * hover, tint, text, focus ring and the informational roles, and each status
 * role's tint. A role is derived only when its base is host-supplied, so the
 * scheme's tuned defaults stay otherwise. `base` is the resolved scheme and
 * preset, which supplies any role the derivation mixes with. A host accent
 * replaces a preset's, so the preset's `onAccent`, tuned to its own accent,
 * gives way to whichever of the scheme's `onAccent` and the light scheme's
 * dark text contrasts more with the host accent; the scheme's when the accent
 * is not an opaque hex or `rgb()` color.
 */
const deriveColorRoles = (
  colorScheme: ColorScheme,
  base: ColorRoles,
  host: Partial<ColorRoles>
): Partial<ColorRoles> => {
  const role = (name: ColorRole) => host[name] ?? base[name];
  const tint = (name: ColorRole) =>
    mix(role(name), softTint[colorScheme], role("background"));
  // The scheme's darkest and lightest roles: the text and the canvas.
  const darkest = colorScheme === "light" ? role("text") : role("background");
  const lightest = colorScheme === "light" ? role("background") : role("text");

  const accentRoles = (accent: string): Partial<ColorRoles> => {
    const accentSoft = host.accentSoft ?? tint("accent");
    const accentText =
      host.accentText ?? mix(accent, accentTextWeight, role("text"));
    const onAccent =
      host.onAccent ??
      mostContrasting(
        accent,
        colorSchemeRoles[colorScheme].onAccent,
        colorSchemeRoles.light.text
      );
    // In light the ring is the accent while it reads on the hover surface,
    // the darkest one (an unmeasurable color is taken to read); otherwise,
    // and always in dark, it moves toward the text.
    const lightFocusRingReads =
      colorScheme === "light" &&
      (contrastRatio(accent, role("surfaceHover")) ?? focusRingContrast) >=
        focusRingContrast;
    return {
      onAccent,
      // Hover moves the accent away from `onAccent`, so the text keeps its
      // contrast: deeper under light text, lighter under dark text.
      accentHover: mix(
        accent,
        accentHoverWeight,
        mostContrasting(onAccent, darkest, lightest)
      ),
      accentSoft,
      accentText,
      focusRing: lightFocusRingReads
        ? accent
        : mix(accent, focusRingWeight, role("text")),
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
 * The custom properties that apply a host's Appearance in the color scheme
 * presented: its values and the roles derived from them. The theme root sets
 * them inline, over the scheme and preset themes. When a preset fixes a
 * scheme other than the one requested, the requested scheme's colors apply
 * under the presented scheme's, so a host's colors (and a legacy theme's,
 * mapped to the scheme it was inferred as) survive the preset.
 */
export const appearanceProperties = (
  schemes: Readonly<{ requested: ColorScheme; presented: ColorScheme }>,
  base: ColorRoles,
  appearance: Appearance
): Readonly<Record<string, string>> =>
  Object.fromEntries([
    ...groupProperties(
      color,
      deriveColorRoles(schemes.presented, base, {
        ...appearance.colors?.[schemes.requested],
        ...appearance.colors?.[schemes.presented],
      })
    ),
    ...groupProperties(radius, appearance.radius),
    ...groupProperties(controlHeight, appearance.controlHeight),
    ...groupProperties(font, appearance.font),
    ...groupProperties(fontWeight, appearance.fontWeight),
  ]);
