import { describe, expect, it } from "vitest";
import {
  appearancePresets,
  type ColorRole,
  type ColorScheme,
  presetColorScheme,
  resolveColorRoles,
} from "../../../src/ui/composition";

type Rgb = readonly [red: number, green: number, blue: number];

// WCAG 2.2 AA thresholds: 1.4.3 for text, 1.4.11 for focus rings and other
// non-text indicators.
const textContrast = 4.5;
const nonTextContrast = 3;

const parseHex = (value: string): Rgb => {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match?.[1]) throw new Error(`Expected an opaque #rrggbb, got ${value}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// A derived role is a CSS `color-mix(in srgb, a p%, b)` of two opaque colors:
// each sRGB channel is a weighted average, as the browser computes it.
const colorMix =
  /^color-mix\(in srgb, (#[0-9a-f]{6}) (\d+(?:\.\d+)?)%, (#[0-9a-f]{6})\)$/i;

const parseColor = (value: string): Rgb => {
  const match = colorMix.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return parseHex(value);
  const weight = Number(match[2]) / 100;
  const first = parseHex(match[1]);
  const second = parseHex(match[3]);
  return [
    first[0] * weight + second[0] * (1 - weight),
    first[1] * weight + second[1] * (1 - weight),
    first[2] * weight + second[2] * (1 - weight),
  ];
};

// WCAG relative luminance: each sRGB channel linearized, then weighted.
const linear = (channel: number) => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: Rgb) =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

const contrast = (foreground: string, background: string) => {
  const a = luminance(parseColor(foreground));
  const b = luminance(parseColor(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

type Pair = {
  readonly foreground: ColorRole;
  readonly background: ColorRole;
  readonly minimum: number;
};

const against =
  (minimum: number) =>
  (foreground: ColorRole, backgrounds: ReadonlyArray<ColorRole>): Array<Pair> =>
    backgrounds.map((background) => ({ foreground, background, minimum }));

const text = against(textContrast);
const nonText = against(nonTextContrast);

const surfaces = [
  "background",
  "surface",
  "surfaceHover",
  "surfaceRaised",
] as const;

const pairs: ReadonlyArray<Pair> = [
  ...text("text", surfaces),
  ...text("textMuted", surfaces),
  ...text("onAccent", ["accent", "accentHover"]),
  ...text("accentText", [...surfaces, "accentSoft"]),
  ...text("success", ["successSoft", "background"]),
  ...text("warning", ["warningSoft", "background"]),
  ...text("danger", ["dangerSoft", "background"]),
  ...text("info", ["infoSoft"]),
  // A focus ring is drawn outside its control, over whichever surface holds it.
  ...nonText("focusRing", surfaces),
  // `borderStrong` is not checked: it is a decorative boundary. Outlined
  // cards are read without their outline, and inputs are identified by their
  // surface fill and the focus ring.
];

// The accent is the only cue of a selected control (the tab underline, a
// checked checkbox or switch, a pressed chip), drawn over any surface. A
// host's own accent is the host's indicator color, so only the accents the
// schemes and presets ship are held to it.
const shippedAccentPairs: ReadonlyArray<Pair> = nonText("accent", surfaces);

const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"];

// Host-supplied accents, from which the accent's other roles derive: one
// dark enough for white text and one light enough to need dark text.
const hostAccents = ["#0E7C66", "#AB95FF"];

// Every Appearance Preset × each color scheme it presents, so a new preset
// joins the check, with and without a host accent. A preset that fixes the
// scheme is checked in that scheme only.
const cases = appearancePresets.flatMap((preset) =>
  [
    ...new Set(
      colorSchemes.map((requested) => presetColorScheme(preset, requested))
    ),
  ].flatMap((colorScheme) => [
    ...[...pairs, ...shippedAccentPairs].map((pair) => ({
      accent: "default accent",
      colorScheme,
      hostColors: {},
      preset,
      ...pair,
    })),
    ...hostAccents.flatMap((accent) =>
      pairs.map((pair) => ({
        accent,
        colorScheme,
        hostColors: { accent },
        preset,
        ...pair,
      }))
    ),
  ])
);

it("checks every preset in the schemes it presents", () => {
  const checked = new Set(
    cases.map(({ colorScheme, preset }) => `${preset} ${colorScheme}`)
  );

  expect([...checked].sort()).toEqual([
    "default dark",
    "default light",
    "finery dark",
    "finery light",
    "porto dark",
    "utila light",
  ]);
});

// White fails on their light accents (Porto 2.48:1, Finery light 3.50:1 and
// dark 2.14:1).
it.each([
  ["porto", "dark"],
  ["finery", "light"],
  ["finery", "dark"],
] as const)("sets dark onAccent text on %s's %s accent", (preset, scheme) => {
  const roles = resolveColorRoles(scheme, preset);

  expect(luminance(parseColor(roles.onAccent))).toBeLessThan(
    luminance(parseColor(roles.accent))
  );
});

describe("onAccent over a host accent", () => {
  it.each(appearancePresets)(
    "keeps a host's own onAccent under %s",
    (preset) => {
      const roles = resolveColorRoles("light", preset, {
        accent: "#AB95FF",
        onAccent: "#FFFFFF",
      });

      expect(roles.onAccent).toBe("#FFFFFF");
    }
  );

  it("falls back to the scheme's onAccent for an accent it cannot measure", () => {
    const roles = resolveColorRoles("dark", "porto", {
      accent: "var(--brand)",
    });

    expect(roles.onAccent).toBe("#FFFFFF");
  });
});

describe("Color Role contrast", () => {
  it.each(cases)(
    "$colorScheme $preset, $accent: $foreground on $background reaches $minimum:1",
    ({ colorScheme, preset, hostColors, foreground, background, minimum }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const ratio = contrast(roles[foreground], roles[background]);

      expect(ratio).toBeGreaterThanOrEqual(minimum);
    }
  );
});
