import { describe, expect, it } from "vitest";
import {
  appearancePresets,
  type ColorRole,
  type ColorScheme,
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

const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"];

// A host-supplied accent, from which the accent's other roles derive.
const hostAccent = "#0E7C66";

// Every scheme × Appearance Preset, so a new preset joins the check, with
// and without a host accent.
const cases = colorSchemes.flatMap((colorScheme) =>
  appearancePresets.flatMap((preset) =>
    [undefined, hostAccent].flatMap((accent) =>
      pairs.map((pair) => ({
        accent: accent ?? "default accent",
        colorScheme,
        hostColors: accent === undefined ? {} : { accent },
        preset,
        ...pair,
      }))
    )
  )
);

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
