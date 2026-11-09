import { type ColorRole, type ColorRoles, color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { font, fontWeight } from "../tokens/typography.stylex";
import { type ColorScheme, colorSchemeRoles } from "./color-schemes";
import { contrastRatio, mixOpaqueColors, mostContrasting } from "./contrast";

/**
 * Host-supplied theme values over the color scheme and Appearance Preset:
 * Color Roles per color scheme, radius, control heights, font and weights.
 * `legacyColors` are a legacy theme's Color Roles, in the scheme it was
 * inferred as, under the host's colors. Every value is a CSS value.
 */
export type Appearance = Readonly<{
  colors?: Readonly<Partial<Record<ColorScheme, Partial<ColorRoles>>>>;
  legacyColors?:
    | Readonly<{ colorScheme: ColorScheme; values: Partial<ColorRoles> }>
    | undefined;
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
// Hover stands at least this WCAG ratio off the accent, so it reads as a
// change, while `onAccent` keeps text contrast on it (WCAG 2.2 1.4.3). The
// weights are tried nearest the accent first; an accent the derivation cannot
// measure takes `fallbackAccentHoverWeight`.
const accentHoverSeparation = 1.2;
const onAccentContrast = 4.5;
const accentHoverWeights = [88, 84, 80, 76, 72, 68, 64, 60];
const fallbackAccentHoverWeight = 80;
// The accent's text moves toward the text role, nearest the accent first,
// until it reads on the darkest surface, the hover one; an accent the
// derivation cannot measure takes the first weight.
const accentTextWeights = [55, 50, 45, 40, 35, 30, 25];
const accentTextContrast = 4.5;
const focusRingWeight = 70;
// WCAG 2.2 1.4.11: a focus ring's contrast on the surface around it.
const focusRingContrast = 3;

/**
 * The accent's hover: the accent moved away from `onAccent` toward `away`
 * until it stands `accentHoverSeparation` off the accent, so the text gains
 * contrast; an accent already at that end (near black under white text)
 * moves toward `onAccent` instead, as far as the text keeps its contrast.
 * The text never loses contrast it had on the accent below 4.5:1.
 */
const deriveAccentHover = (
  accent: string,
  onAccent: string,
  away: string
): string => {
  const accentTextContrast = contrastRatio(onAccent, accent) ?? 0;
  const textFloor = Math.min(onAccentContrast, accentTextContrast);
  const reads = (hover: string | undefined): hover is string =>
    hover !== undefined &&
    (contrastRatio(hover, accent) ?? 0) >= accentHoverSeparation &&
    (contrastRatio(onAccent, hover) ?? 0) >= textFloor;
  return (
    [away, onAccent]
      .flatMap((target) =>
        accentHoverWeights.map((weight) =>
          mixOpaqueColors(accent, weight, target)
        )
      )
      .find(reads) ?? mix(accent, fallbackAccentHoverWeight, away)
  );
};

/**
 * Derives the roles a host did not set from the ones it did: the accent's
 * hover, tint, text and focus ring, and each status role's tint, `info`'s
 * among them. A role is derived only when its base is host-supplied, so the
 * scheme's tuned defaults stay otherwise: `info` is a hue of its own, so a
 * host accent leaves it as shipped. `base` is the resolved scheme and
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
      host.accentText ??
      accentTextWeights
        .map((weight) => mixOpaqueColors(accent, weight, role("text")))
        .find(
          (candidate): candidate is string =>
            candidate !== undefined &&
            (contrastRatio(candidate, role("surfaceHover")) ??
              accentTextContrast) >= accentTextContrast
        ) ??
      mix(accent, accentTextWeights[0] ?? 55, role("text"));
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
      // Hover deepens the accent under light text and lightens it under dark
      // text (see `deriveAccentHover`).
      accentHover: deriveAccentHover(
        accent,
        onAccent,
        mostContrasting(onAccent, darkest, lightest)
      ),
      accentSoft,
      accentText,
      focusRing: lightFocusRingReads
        ? accent
        : mix(accent, focusRingWeight, role("text")),
    };
  };
  const statusTint = (status: "success" | "warning" | "danger" | "info") =>
    host[status] === undefined ? {} : { [`${status}Soft`]: tint(status) };

  return {
    ...(host.accent === undefined ? {} : accentRoles(host.accent)),
    ...statusTint("success"),
    ...statusTint("warning"),
    ...statusTint("danger"),
    ...statusTint("info"),
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
 * them inline, over the scheme and preset themes. The host's colors apply in
 * the presented scheme only: a preset that fixes another scheme than the one
 * requested sets that scheme's text roles, which the requested scheme's
 * colors were not chosen against. A legacy theme's colors, under the host's,
 * apply in the requested or presented scheme when it is the one the theme was
 * inferred as, so they survive a preset that fixes another scheme. A host's
 * `sans` font sets figures too, over a preset's figure font.
 */
export const appearanceProperties = (
  schemes: Readonly<{ requested: ColorScheme; presented: ColorScheme }>,
  base: ColorRoles,
  appearance: Appearance
): Readonly<Record<string, string>> => {
  const legacy = appearance.legacyColors;
  const legacyApplies =
    legacy !== undefined &&
    (legacy.colorScheme === schemes.requested ||
      legacy.colorScheme === schemes.presented);

  return Object.fromEntries([
    ...groupProperties(
      color,
      deriveColorRoles(schemes.presented, base, {
        ...(legacyApplies ? legacy.values : {}),
        ...appearance.colors?.[schemes.presented],
      })
    ),
    ...groupProperties(radius, appearance.radius),
    ...groupProperties(controlHeight, appearance.controlHeight),
    ...groupProperties(font, {
      ...(appearance.font?.sans === undefined
        ? {}
        : { figure: appearance.font.sans }),
      ...appearance.font,
    }),
    ...groupProperties(fontWeight, appearance.fontWeight),
  ]);
};
