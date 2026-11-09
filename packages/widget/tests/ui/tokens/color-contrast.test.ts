import { describe, expect, it } from "vitest";
import {
  appearancePresets,
  type ColorRole,
  type ColorScheme,
  presetColorScheme,
  resolveColorRoles,
} from "../../../src/ui/composition";
import { focusRing, selectionRing } from "../../../src/ui/tokens/border.stylex";
import {
  badgeTint,
  pressTint,
  softControlTint,
} from "../../../src/ui/tokens/color.stylex";

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

// `color-mix(in srgb, a p%, b)` of two opaque colors: each sRGB channel is a
// weighted average, as the browser computes it.
const mix = (first: Rgb, percent: number, second: Rgb): Rgb => {
  const weight = percent / 100;
  return [
    first[0] * weight + second[0] * (1 - weight),
    first[1] * weight + second[1] * (1 - weight),
    first[2] * weight + second[2] * (1 - weight),
  ];
};

// A derived role is a CSS `color-mix` of two opaque colors.
const colorMix =
  /^color-mix\(in srgb, (#[0-9a-f]{6}) (\d+(?:\.\d+)?)%, (#[0-9a-f]{6})\)$/i;

const parseColor = (value: string): Rgb => {
  const match = colorMix.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return parseHex(value);
  return mix(parseHex(match[1]), Number(match[2]), parseHex(match[3]));
};

// WCAG relative luminance: each sRGB channel linearized, then weighted.
const linear = (channel: number) => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: Rgb) =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

const contrast = (foreground: Rgb, background: Rgb) => {
  const a = luminance(foreground);
  const b = luminance(background);
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
  // Status text sits on rows and cards as well as its own tint.
  ...text("success", [...surfaces, "successSoft"]),
  ...text("warning", [...surfaces, "warningSoft"]),
  ...text("danger", [...surfaces, "dangerSoft"]),
  ...text("info", [...surfaces, "infoSoft"]),
  // A focus ring is drawn outside its control, over whichever surface holds
  // it; inside a full-width row, over the row's fill, a selected row's tint
  // among them.
  ...nonText("focusRing", [...surfaces, "accentSoft"]),
  // A waiting step's ring is its only mark, drawn in `textMuted` over
  // whichever surface holds the timeline. A step under way is marked by its
  // accent arc, held by the accent pairs below; its track is decorative.
  ...nonText("textMuted", surfaces),
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
const allThemes = appearancePresets.flatMap((preset) =>
  [
    ...new Set(
      colorSchemes.map((requested) => presetColorScheme(preset, requested))
    ),
  ].flatMap((colorScheme) => [
    { accent: "default accent", colorScheme, hostColors: {}, preset },
    ...hostAccents.map((accent) => ({
      accent,
      colorScheme,
      hostColors: { accent },
      preset,
    })),
  ])
);

// Utila keeps the palette it ships with on `main`, whose secondary text and
// light accent chips read below these thresholds: a product decision, so the
// contrast checks skip it. Its cards' edges are still checked below.
const contrastExemptPresets: ReadonlyArray<string> = ["utila"];
const themes = allThemes.filter(
  ({ preset }) => !contrastExemptPresets.includes(preset)
);

const cases = themes.flatMap((theme) =>
  [
    ...pairs,
    ...(theme.accent === "default accent" ? shippedAccentPairs : []),
  ].map((pair) => ({ ...theme, ...pair }))
);

it("checks every preset in the schemes it presents, but the exempt ones", () => {
  const checked = new Set(
    cases.map(({ colorScheme, preset }) => `${preset} ${colorScheme}`)
  );

  expect([...checked].sort()).toEqual([
    "default dark",
    "default light",
    "finery dark",
    "finery light",
    "porto dark",
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
      const ratio = contrast(
        parseColor(roles[foreground]),
        parseColor(roles[background])
      );

      expect(ratio).toBeGreaterThanOrEqual(minimum);
    }
  );
});

// A filled card, row or input is `surface` straight on the canvas, with no
// edge of its own, so its fill alone has to set it off `background`. The
// ratio is far below a text threshold: it is what keeps a card's edge visible
// on a dim display, not a legibility bar. Finery's Host Profile presents
// elevated surfaces, which lift its cards off the canvas as `surfaceRaised`
// with the `raised` elevation, so its `surface` does not bound a card.
// Utila's presents outlined surfaces, which edge every filled card in
// `border`, so that edge, not the fill, sets a card off the canvas there.
const surfaceSeparation = 1.15;
const elevatedPresets: ReadonlyArray<string> = ["finery"];
const outlinedPresets: ReadonlyArray<string> = ["utila"];

const filledSurfaceThemes = themes.filter(
  ({ preset }) =>
    !elevatedPresets.includes(preset) && !outlinedPresets.includes(preset)
);
const outlinedSurfaceThemes = allThemes.filter(({ preset }) =>
  outlinedPresets.includes(preset)
);

describe("filled surface separation", () => {
  it.each(filledSurfaceThemes)(
    "$colorScheme $preset, $accent: surface stands off background",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);

      expect(
        contrast(parseColor(roles.surface), parseColor(roles.background))
      ).toBeGreaterThanOrEqual(surfaceSeparation);
    }
  );

  it.each(outlinedSurfaceThemes)(
    "$colorScheme $preset, $accent: a card's border stands off background",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);

      expect(
        contrast(parseColor(roles.border), parseColor(roles.background))
      ).toBeGreaterThanOrEqual(surfaceSeparation);
    }
  );
});

// A primary button's hover is its only pointer cue besides the cursor, so it
// stands this WCAG ratio off the accent to read as a change, with `onAccent`
// still at text contrast on it. Beyond the host accents checked above, an
// accent near black under white text, near white under dark text, and a
// saturated mid-tone must derive a distinct hover too.
const accentHoverSeparation = 1.15;
const hoverHostAccents = [...hostAccents, "#222222", "#FFD400", "#4C62FF"];

const hoverThemes = themes
  .filter((theme) => theme.accent === "default accent")
  .flatMap((theme) => [
    theme,
    ...hoverHostAccents.map((accent) => ({
      ...theme,
      accent,
      hostColors: { accent },
    })),
  ]);

describe("accent hover", () => {
  it.each(hoverThemes)(
    "$colorScheme $preset, $accent: hover stands off the accent under readable onAccent",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const accent = parseColor(roles.accent);
      const hover = parseColor(roles.accentHover);

      expect(contrast(accent, hover)).toBeGreaterThanOrEqual(
        accentHoverSeparation
      );
      expect(
        contrast(parseColor(roles.onAccent), hover)
      ).toBeGreaterThanOrEqual(textContrast);
    }
  );
});

// A disabled primary or soft button is a `textMuted` label on a
// `surfaceHover` fill at full opacity: the label often says why it is
// disabled, so it keeps text contrast, and the fill stands off the canvas
// the button sits on. Finery's canvas is near its surfaces, as its cards are
// lifted by elevation, so the fill's bar is lower than a card's.
const disabledFillSeparation = 1.1;

describe("disabled button", () => {
  it.each(themes)(
    "$colorScheme $preset, $accent: the label reads on the disabled fill",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const fill = parseColor(roles.surfaceHover);

      expect(
        contrast(parseColor(roles.textMuted), fill)
      ).toBeGreaterThanOrEqual(textContrast);
      expect(
        contrast(fill, parseColor(roles.background))
      ).toBeGreaterThanOrEqual(disabledFillSeparation);
    }
  );
});

// A pressed filled button mixes its fill by the `pressTint` weights: the
// primary's hover takes `shade` of `ink`; a soft fill takes `toneFill` of its
// label color. The label keeps text contrast on the pressed fill.
const pressCases = themes.flatMap((theme) =>
  (
    [
      { variant: "soft", label: "accentText", fill: "accentSoft" },
      { variant: "danger", label: "danger", fill: "dangerSoft" },
    ] as const
  ).map((press) => ({ ...theme, ...press }))
);

describe("pressed button contrast", () => {
  it.each(themes)(
    "$colorScheme $preset, $accent: onAccent reads on the pressed primary",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const pressed = mix(
        parseColor(roles.accentHover),
        100 - Number.parseFloat(pressTint.shade),
        parseHex(pressTint.ink)
      );

      expect(
        contrast(parseColor(roles.onAccent), pressed)
      ).toBeGreaterThanOrEqual(textContrast);
    }
  );

  it.each(pressCases)(
    "$colorScheme $preset, $accent: $label reads on the pressed $variant button",
    ({ colorScheme, preset, hostColors, label, fill }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const labelColor = parseColor(roles[label]);
      const pressed = mix(
        labelColor,
        Number.parseFloat(pressTint.toneFill),
        parseColor(roles[fill])
      );

      expect(contrast(labelColor, pressed)).toBeGreaterThanOrEqual(
        textContrast
      );
    }
  );
});

// A soft badge mixes its tone's text color into `surface`, the fill of the
// rows and cards it sits on, by the `badgeTint` weights; under elevated
// surfaces, whose cards are `surfaceRaised`, its fill mixes into that. Its
// 1px edge, not its faint fill, sets it off the surface; a hairline needs
// more than the 1.3:1 a filled area would.
const badgeEdgeContrast = 1.5;

// Each soft badge tone: the text color it mixes and its edge's weight.
const badgeTones = {
  neutral: { textRole: "text", edgeWeight: badgeTint.neutralEdge },
  accent: { textRole: "accentText", edgeWeight: badgeTint.edge },
  success: { textRole: "success", edgeWeight: badgeTint.edge },
  warning: { textRole: "warning", edgeWeight: badgeTint.edge },
  danger: { textRole: "danger", edgeWeight: badgeTint.edge },
  info: { textRole: "info", edgeWeight: badgeTint.edge },
} as const satisfies Readonly<
  Record<string, { textRole: ColorRole; edgeWeight: string }>
>;

const badgeCases = themes.flatMap((theme) =>
  Object.entries(badgeTones).flatMap(([tone, badge]) =>
    (elevatedPresets.includes(theme.preset)
      ? (["surface", "surfaceRaised"] as const)
      : (["surface"] as const)
    ).map((base) => ({ ...theme, ...badge, base, tone }))
  )
);

describe("soft badge contrast", () => {
  it.each(badgeCases)(
    "$colorScheme $preset, $accent: $tone badge filled over $base reads on every surface",
    ({ colorScheme, preset, hostColors, textRole, edgeWeight, base }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const toneText = parseColor(roles[textRole]);
      const fill = mix(
        toneText,
        Number.parseFloat(badgeTint.fill),
        parseColor(roles[base])
      );
      const edge = mix(
        toneText,
        Number.parseFloat(edgeWeight),
        parseColor(roles.surface)
      );

      expect(contrast(toneText, fill)).toBeGreaterThanOrEqual(textContrast);
      for (const background of surfaces) {
        expect(
          contrast(edge, parseColor(roles[background])),
          background
        ).toBeGreaterThanOrEqual(badgeEdgeContrast);
      }
    }
  );
});

// A soft control (an `ActionCard`'s Claim or Withdraw button, the amount
// panel's "Max" chip) sits on a filled card whose `surface` its `accentSoft`
// fill nearly matches in every scheme: a tint faint enough to keep the accent
// text at 4.5:1 cannot stand 1.3:1 off `surface` (the default light accent
// reaches 1.29:1 only at 4.38:1 text). So, as a soft badge does, it is set
// off by a 1px edge: its label color mixed into `surface` by
// `softControlTint.edge`, at least the badge edge's 1.5:1 on every surface.
// The soft button's hover fill moves toward `surfaceHover`, under the same
// label.
describe("soft control contrast", () => {
  it.each(themes)(
    "$colorScheme $preset, $accent: a soft control's edge reads on every surface",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const edge = mix(
        parseColor(roles.accentText),
        Number.parseFloat(softControlTint.edge),
        parseColor(roles.surface)
      );

      for (const background of surfaces) {
        expect(
          contrast(edge, parseColor(roles[background])),
          background
        ).toBeGreaterThanOrEqual(badgeEdgeContrast);
      }
    }
  );

  it.each(themes)(
    "$colorScheme $preset, $accent: accentText reads on the hovered soft button",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const hovered = mix(
        parseColor(roles.accentSoft),
        50,
        parseColor(roles.surfaceHover)
      );

      expect(
        contrast(parseColor(roles.accentText), hovered)
      ).toBeGreaterThanOrEqual(textContrast);
    }
  );
});

// WCAG relative luminance does not tell hues apart, so `info` is held to its
// own hue, apart from the accent's, wherever the accent is one the schemes
// and presets ship: an informational notice or a pending position never
// reads as a selected control or an accent card.
const infoHueSeparation = 25;

// The sRGB hue angle, in degrees, of an opaque color.
const hue = ([red, green, blue]: Rgb) => {
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (delta === 0) return 0;
  const sector = (() => {
    if (max === red) return ((green - blue) / delta + 6) % 6;
    if (max === green) return (blue - red) / delta + 2;
    return (red - green) / delta + 4;
  })();
  return sector * 60;
};

const hueDistance = (first: Rgb, second: Rgb) => {
  const distance = Math.abs(hue(first) - hue(second));
  return Math.min(distance, 360 - distance);
};

const shippedAccentThemes = themes.filter(
  (theme) => theme.accent === "default accent"
);
const hostAccentThemes = themes.filter(
  (theme) => theme.accent !== "default accent"
);

// A host info dark enough for text on light tints, and one light enough for
// dark ones.
const hostInfo = { light: "#0B5C8E", dark: "#8CCBF7" } as const;

describe("info", () => {
  it.each(shippedAccentThemes)(
    "$colorScheme $preset: info's hue stands apart from the accent's",
    ({ colorScheme, preset }) => {
      const roles = resolveColorRoles(colorScheme, preset);

      expect(
        hueDistance(parseColor(roles.info), parseColor(roles.accent))
      ).toBeGreaterThanOrEqual(infoHueSeparation);
      expect(
        hueDistance(parseColor(roles.infoSoft), parseColor(roles.accentSoft))
      ).toBeGreaterThanOrEqual(infoHueSeparation);
    }
  );

  it.each(hostAccentThemes)(
    "$colorScheme $preset, $accent: a host accent leaves info as shipped",
    ({ colorScheme, preset, hostColors }) => {
      const shipped = resolveColorRoles(colorScheme, preset);
      const roles = resolveColorRoles(colorScheme, preset, hostColors);

      expect(roles.info).toBe(shipped.info);
      expect(roles.infoSoft).toBe(shipped.infoSoft);
    }
  );

  it.each(shippedAccentThemes)(
    "$colorScheme $preset: a host's info derives its soft tint",
    ({ colorScheme, preset }) => {
      const shipped = resolveColorRoles(colorScheme, preset);
      const info = hostInfo[colorScheme];
      const roles = resolveColorRoles(colorScheme, preset, { info });

      expect(roles.infoSoft).not.toBe(shipped.infoSoft);
      expect(
        contrast(parseHex(info), parseColor(roles.infoSoft))
      ).toBeGreaterThanOrEqual(textContrast);
    }
  );

  // A pressable info card moves its tint toward the hover surface, under the
  // same text.
  it.each(themes)(
    "$colorScheme $preset, $accent: info reads on its hovered tint",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const hovered = mix(
        parseColor(roles.infoSoft),
        50,
        parseColor(roles.surfaceHover)
      );

      expect(contrast(parseColor(roles.info), hovered)).toBeGreaterThanOrEqual(
        textContrast
      );
    }
  );
});

// Hover is a pointer's only cue on a filled row or card, so `surfaceHover`
// stands this far off the fill it replaces: `surface`, or `surfaceRaised`
// where the Host Profile lifts cards off the canvas.
const hoverSeparation = 1.12;

describe("hover surface", () => {
  it.each(themes)(
    "$colorScheme $preset, $accent: hover stands off the fill it replaces",
    ({ colorScheme, preset, hostColors }) => {
      const roles = resolveColorRoles(colorScheme, preset, hostColors);
      const fill = elevatedPresets.includes(preset)
        ? roles.surfaceRaised
        : roles.surface;

      expect(
        contrast(parseColor(roles.surfaceHover), parseColor(fill))
      ).toBeGreaterThanOrEqual(hoverSeparation);
    }
  );
});

// Focus and selection can share a color (the default light accent is its
// focus ring), so they differ by shape, measured from the control's edge:
// focus is a ring outside the edge past a gap where the canvas shows, and
// selection a ring inside the edge over a tint. Where a clipping or
// scrolling container keeps focus inside the edge, it is two lines with a
// gap between, where selection is one. A focused selected surface draws the
// same two lines from the selection ring outward, so it keeps its selection
// ring beside the focus ring.
describe("focus ring apart from the selection ring", () => {
  it("draws focus outside the edge past a gap, and selection inside it", () => {
    const gap = Number.parseFloat(focusRing.offset);
    const ring = Number.parseFloat(focusRing.width);

    expect(gap).toBeGreaterThanOrEqual(ring);
    expect(Number.parseFloat(focusRing.extent)).toBe(gap + ring);
    expect(
      Number.parseFloat(selectionRing.offset) +
        Number.parseFloat(selectionRing.width)
    ).toBeLessThanOrEqual(0);
  });

  it("draws focus inside the edge as two lines and a gap", () => {
    const inset = Number.parseFloat(focusRing.insetWidth);

    expect(focusRing.insetStyle).toBe("double");
    expect(inset).toBe(3 * Number.parseFloat(focusRing.width));
    expect(Number.parseFloat(focusRing.insetOffset)).toBe(-inset);
  });

  it("keeps a focused selection's ring inside the edge, with the focus ring outside it", () => {
    expect(
      Number.parseFloat(selectionRing.offset) +
        Number.parseFloat(focusRing.insetWidth)
    ).toBe(Number.parseFloat(focusRing.extent));
    expect(Number.parseFloat(selectionRing.width)).toBe(
      Number.parseFloat(focusRing.width)
    );
  });
});
