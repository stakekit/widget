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

// WCAG relative luminance: each sRGB channel linearized, then weighted.
const linear = (channel: number) => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: Rgb) =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

const contrast = (foreground: string, background: string) => {
  const a = luminance(parseHex(foreground));
  const b = luminance(parseHex(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

type Pair = {
  readonly foreground: ColorRole;
  readonly background: ColorRole;
  readonly minimum: number;
};

const text = (
  foreground: ColorRole,
  backgrounds: ReadonlyArray<ColorRole>
): Array<Pair> =>
  backgrounds.map((background) => ({
    foreground,
    background,
    minimum: textContrast,
  }));

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
  ...text("accentText", ["background", "surface", "accentSoft"]),
  ...text("success", ["successSoft", "background"]),
  ...text("warning", ["warningSoft", "background"]),
  ...text("danger", ["dangerSoft", "background"]),
  ...text("info", ["infoSoft"]),
  {
    foreground: "focusRing",
    background: "background",
    minimum: nonTextContrast,
  },
  // `borderStrong` is not checked: it is a decorative boundary. Outlined
  // cards are read without their outline, and inputs are identified by their
  // surface fill and the focus ring.
];

const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"];

// Every scheme × Appearance Preset, so a new preset joins the check.
const cases = colorSchemes.flatMap((colorScheme) =>
  appearancePresets.flatMap((preset) =>
    pairs.map((pair) => ({ colorScheme, preset, ...pair }))
  )
);

describe("Color Role contrast", () => {
  it.each(cases)(
    "$colorScheme $preset: $foreground on $background reaches $minimum:1",
    ({ colorScheme, preset, foreground, background, minimum }) => {
      const roles = resolveColorRoles(colorScheme, preset);
      const ratio = contrast(roles[foreground], roles[background]);

      expect(ratio).toBeGreaterThanOrEqual(minimum);
    }
  );
});
