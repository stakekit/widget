import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, References, Result } from "effect";

import type { SKAppearance } from "../../../src/public-api/appearance";
import type { SKHostConfiguration } from "../../../src/public-api/react-types";
import type { SKTheme } from "../../../src/public-api/theme";
import { legacyThemeDefaults } from "../../../src/services/config/legacy-theme-defaults";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { decodeHostConfiguration } from "../../../src/services/config/widget-config-boundary";

const decode = (settings: Partial<SKHostConfiguration>) => {
  const result = decodeHostConfiguration({
    apiKey: "api-key",
    variant: "default",
    ...settings,
  } as SKHostConfiguration);
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

/** The deprecated public `lightTheme` and `darkTheme` exports' values. */
const { dark: darkTheme, light: lightTheme } = legacyThemeDefaults;

const staleHostAppearance = (input: unknown) => input as SKAppearance;

const noValues = {
  colors: { light: {}, dark: {} },
  radius: {},
  controlHeight: {},
  font: {},
  fontWeight: {},
};

/** A legacy theme with one leaf set, by dotted path. */
const legacyLeaf = (path: string, value: string): SKTheme =>
  path
    .split(".")
    .reduceRight<unknown>((child, key) => ({ [key]: child }), value) as SKTheme;

describe("appearance at the Host Configuration boundary", () => {
  it("defaults to the light scheme with no values", () => {
    expect(decode({}).configuration.appearance).toEqual({
      colorScheme: "light",
      ...noValues,
    });
  });

  it("keeps every valid value", () => {
    const appearance: SKAppearance = {
      colorScheme: "system",
      colors: {
        light: { accent: "#0E7C66", text: "#111111" },
        dark: { accent: "#7C3AED" },
      },
      radius: { control: "4px", shell: "0" },
      controlHeight: { lg: "52px" },
      font: { sans: "Inter, sans-serif" },
      fontWeight: { semibold: "700" },
    };

    const decoded = decode({ appearance });

    expect(decoded.configuration.appearance).toEqual({
      colorScheme: "system",
      colors: {
        light: { accent: "#0E7C66", text: "#111111" },
        dark: { accent: "#7C3AED" },
      },
      radius: { control: "4px", shell: "0" },
      controlHeight: { lg: "52px" },
      font: { sans: "Inter, sans-serif" },
      fontWeight: { semibold: "700" },
    });
    expect(decoded.warnings).toEqual([]);
  });

  it("drops each invalid value with a warning and applies the rest", () => {
    const decoded = decode({
      appearance: staleHostAppearance({
        colorScheme: "sepia",
        colors: {
          light: { accent: 42, text: "#111111", notARole: "#fff" },
          dark: "#000",
        },
        radius: { card: "" },
        controlHeight: "48px",
        fontWeight: { medium: "550" },
      }),
      hideGasFee: true,
    });

    expect(decoded.configuration.appearance).toEqual({
      ...noValues,
      colorScheme: "light",
      colors: { light: { text: "#111111" }, dark: {} },
      fontWeight: { medium: "550" },
    });
    expect(decoded.configuration.hideGasFee).toBe(true);
    expect(decoded.warnings).toEqual([
      {
        _tag: "Appearance",
        issue: "invalid-appearance-value",
        path: "colorScheme",
      },
      {
        _tag: "Appearance",
        issue: "invalid-appearance-value",
        path: "colors.light.accent",
      },
      {
        _tag: "Appearance",
        issue: "invalid-appearance-value",
        path: "colors.dark",
      },
      {
        _tag: "Appearance",
        issue: "invalid-appearance-value",
        path: "radius.card",
      },
      {
        _tag: "Appearance",
        issue: "invalid-appearance-value",
        path: "controlHeight",
      },
    ]);
  });

  it("drops a non-object appearance with a warning and applies the rest", () => {
    const decoded = decode({
      appearance: staleHostAppearance("dark"),
      hideGasFee: true,
    });

    expect(decoded.configuration.appearance).toEqual({
      colorScheme: "light",
      ...noValues,
    });
    expect(decoded.configuration.hideGasFee).toBe(true);
    expect(decoded.warnings).toEqual([
      {
        _tag: "Appearance",
        issue: "invalid-appearance-root",
        path: "appearance",
      },
    ]);
  });
});

/**
 * The spec's legacy mapping table, row by row, in priority order. Each row's
 * keys are checked alone, and the first two together.
 */
const colorRows = [
  [
    "background",
    [
      "color.background",
      "color.primary",
      "color.modalBodyBackground",
      "color.secondaryButtonBackground",
    ],
  ],
  [
    "surface",
    [
      "color.backgroundMuted",
      "color.stakeSectionBackground",
      "color.tokenSelectBackground",
      "color.summaryItemBackground",
      "color.dashboardDetailsSectionBackground",
      "color.skeletonLoaderBase",
    ],
  ],
  [
    "surfaceHover",
    ["color.tokenSelectHoverBackground", "color.skeletonLoaderHighlight"],
  ],
  ["surfaceRaised", ["color.dropdownBackground"]],
  ["border", ["color.tabBorder"]],
  ["borderStrong", ["color.tokenSelectBorder"]],
  [
    "text",
    [
      "color.text",
      "color.tokenSelect",
      "color.secondaryButtonColor",
      "color.smallButtonColor",
    ],
  ],
  ["textMuted", ["color.textMuted"]],
  ["accent", ["color.primaryButtonBackground", "color.accent"]],
  ["onAccent", ["color.primaryButtonColor"]],
  ["accentSoft", ["color.smallLightButtonBackground"]],
  ["accentText", ["color.smallLightButtonColor"]],
  [
    "success",
    [
      "color.statusSuccess",
      "color.positionsRewardRate",
      "color.positionsClaimRewardsBackground",
      "color.selectValidatorMultiSelectedBackground",
    ],
  ],
  ["warning", ["color.statusWarning", "color.positionsPendingBackground"]],
  ["warningSoft", ["color.warningBoxBackground"]],
  [
    "danger",
    [
      "color.textDanger",
      "color.errorBoxBackground",
      "color.positionsActionRequiredBackground",
    ],
  ],
  ["scrim", ["color.modalOverlayBackground"]],
] as const;

const settingRows = [
  ["font", "sans", ["font.body"]],
  ["fontWeight", "regular", ["fontWeight.normal"]],
  ["fontWeight", "medium", ["fontWeight.medium"]],
  ["fontWeight", "semibold", ["fontWeight.semibold"]],
  [
    "radius",
    "control",
    [
      "borderRadius.baseContract.primaryButton",
      "borderRadius.baseContract.secondaryButton",
    ],
  ],
  ["radius", "card", ["borderRadius.baseContract.xl"]],
  ["radius", "overlay", ["borderRadius.baseContract.2xl"]],
  ["radius", "shell", ["borderRadius.baseContract.widgetBorderRadius"]],
  ["controlHeight", "lg", ["space.buttonMinHeight"]],
] as const;

const colorKeyCases = colorRows.flatMap(([role, keys]) =>
  keys.map((key) => ({ key, role }))
);
const settingKeyCases = settingRows.flatMap(([group, setting, keys]) =>
  keys.map((key) => ({ group, key, setting }))
);

describe("legacy theme mapping", () => {
  it("gives an unchanged lightTheme the light default with nothing dropped", () => {
    const decoded = decode({ theme: lightTheme });

    expect(decoded.configuration.appearance).toEqual({
      colorScheme: "light",
      ...noValues,
    });
    expect(decoded.droppedLegacyThemeKeys).toEqual([]);
  });

  it("gives an unchanged darkTheme the dark default with nothing dropped", () => {
    const decoded = decode({ theme: darkTheme });

    expect(decoded.configuration.appearance).toEqual({
      colorScheme: "dark",
      ...noValues,
    });
    expect(decoded.droppedLegacyThemeKeys).toEqual([]);
  });

  it("feeds the legacy theme only into the Appearance", () => {
    const theme = {
      color: { ...darkTheme.color, primaryButtonBackground: "#FF5500" },
    };

    expect(decode({ theme }).configuration).not.toHaveProperty("theme");
  });

  it("infers dark from a customized darkTheme and maps into its colors", () => {
    const decoded = decode({
      theme: {
        ...darkTheme,
        color: { ...darkTheme.color, primaryButtonBackground: "#FF5500" },
      },
    });

    expect(decoded.configuration.appearance).toEqual({
      ...noValues,
      colorScheme: "dark",
      colors: { light: {}, dark: { accent: "#FF5500" } },
    });
  });

  it("infers light from a partial theme that matches no dark default", () => {
    expect(
      decode({ theme: { color: { primaryButtonBackground: "#FF5500" } } })
        .configuration.appearance.colorScheme
    ).toBe("light");
  });

  it.each(colorKeyCases)("maps $key onto the $role role", ({ key, role }) => {
    const decoded = decode({ theme: legacyLeaf(key, "#123456") });

    expect(decoded.configuration.appearance.colors).toEqual({
      light: { [role]: "#123456" },
      dark: {},
    });
    expect(decoded.droppedLegacyThemeKeys).toEqual([]);
  });

  it.each(settingKeyCases)(
    "maps $key onto $group.$setting",
    ({ group, key, setting }) => {
      const decoded = decode({ theme: legacyLeaf(key, "7px") });

      expect(decoded.configuration.appearance[group]).toEqual({
        [setting]: "7px",
      });
      expect(decoded.droppedLegacyThemeKeys).toEqual([]);
    }
  );

  it.each(
    colorRows.flatMap(([role, [first, second]]) =>
      second === undefined ? [] : [{ first, role, second }]
    )
  )("lets $first win over $second for $role", ({ first, role, second }) => {
    const decoded = decode({
      theme: {
        color: {
          ...legacyLeaf(second, "#222222").color,
          ...legacyLeaf(first, "#111111").color,
        },
      },
    });

    expect(decoded.configuration.appearance.colors.light[role]).toBe("#111111");
    expect(decoded.droppedLegacyThemeKeys).toEqual([second]);
  });

  it("lets the second key apply when the first is unchanged", () => {
    const decoded = decode({
      theme: {
        color: { ...lightTheme.color, accent: "#123456" },
      },
    });

    expect(decoded.configuration.appearance.colors.light).toEqual({
      accent: "#123456",
    });
  });

  it("drops customized keys without a role and lists them", () => {
    const decoded = decode({
      theme: {
        ...lightTheme,
        color: {
          ...lightTheme.color,
          disabledButtonBackground: "#cccccc",
          tooltipBackground: "#222222",
          white: "#fefefe",
        },
        fontSize: { ...lightTheme.fontSize, md: "15px" },
        fontWeight: { ...lightTheme.fontWeight, bold: "800" },
        borderRadius: {
          baseContract: { ...lightTheme.borderRadius.baseContract, sm: "3px" },
        },
        space: { ...lightTheme.space, "4": "18px" },
        zIndices: { ...lightTheme.zIndices, modal: "99" },
      },
    });

    expect(decoded.configuration.appearance).toEqual({
      colorScheme: "light",
      ...noValues,
    });
    expect([...decoded.droppedLegacyThemeKeys].sort()).toEqual(
      [
        "borderRadius.baseContract.sm",
        "color.disabledButtonBackground",
        "color.tooltipBackground",
        "color.white",
        "fontSize.md",
        "fontWeight.bold",
        "space.4",
        "zIndices.modal",
      ].sort()
    );
  });

  it("lets appearance win key by key", () => {
    const decoded = decode({
      appearance: {
        colorScheme: "system",
        colors: { light: { accent: "#0E7C66" } },
        radius: { card: "8px" },
      },
      theme: {
        color: {
          primaryButtonBackground: "#FF5500",
          background: "#FAFAFA",
        },
        borderRadius: { baseContract: { xl: "24px", "2xl": "28px" } },
      },
    });

    expect(decoded.configuration.appearance).toEqual({
      ...noValues,
      colorScheme: "system",
      colors: {
        light: { accent: "#0E7C66", background: "#FAFAFA" },
        dark: {},
      },
      radius: { card: "8px", overlay: "28px" },
    });
  });

  it("keeps the inferred scheme unless appearance sets one", () => {
    expect(
      decode({ appearance: {}, theme: darkTheme }).configuration.appearance
        .colorScheme
    ).toBe("dark");
    expect(
      decode({ appearance: { colorScheme: "light" }, theme: darkTheme })
        .configuration.appearance.colorScheme
    ).toBe("light");
  });
});

describe("legacy theme warning", () => {
  it.effect(
    "warns once, listing the dropped keys and pointing to appearance",
    () =>
      Effect.gen(function* () {
        const warnings: Array<{ message: unknown; annotations: object }> = [];
        const logger = Logger.make<unknown, void>((options) => {
          if (options.logLevel !== "Warn") return;
          warnings.push({
            annotations: {
              ...options.fiber.getRef(References.CurrentLogAnnotations),
            },
            message: options.message,
          });
        });
        const configuration = {
          apiKey: "api-key",
          theme: {
            ...lightTheme,
            color: { ...lightTheme.color, tooltipBackground: "#222222" },
          },
          variant: "default",
        } as const;

        yield* Effect.gen(function* () {
          const config = yield* WidgetConfigService;
          yield* config.update({ ...configuration, hideGasFee: true });
        }).pipe(
          Effect.provide(
            Layer.merge(
              // Mounting logs too, so its logger is provided as well.
              WidgetConfigService.layer(configuration).pipe(
                Layer.provide(Logger.layer([logger]))
              ),
              Logger.layer([logger])
            )
          )
        );

        expect(warnings).toEqual([
          {
            annotations: {
              event: "legacy_theme_keys_dropped",
              keys: ["color.tooltipBackground"],
            },
            message: [
              "Legacy theme values no longer apply; set them through `appearance`",
            ],
          },
        ]);
      })
  );
});
