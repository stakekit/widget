import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, References, Result } from "effect";
import type { SKHostConfiguration } from "../../../src/public-api/react-types";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import {
  decodeHostConfiguration,
  decodeRejectedConfigurationPresentation,
} from "../../../src/services/config/widget-config-boundary";
import type { WidgetLayout } from "../../../src/services/config/widget-config-model";

const currentLayout = (configuration: SKHostConfiguration) =>
  WidgetConfigService.use((config) => config.current).pipe(
    Effect.map((config) => config.layout),
    Effect.provide(WidgetConfigService.layer(configuration))
  );

/** The warnings mounting `initial` and applying `updates` log. */
const configurationWarnings = (
  initial: SKHostConfiguration,
  updates: ReadonlyArray<SKHostConfiguration>
) =>
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

    yield* Effect.gen(function* () {
      const config = yield* WidgetConfigService;
      for (const update of updates) yield* config.update(update);
    }).pipe(
      Effect.provide(
        Layer.merge(
          // Mounting logs too, so its logger is provided as well.
          WidgetConfigService.layer(initial).pipe(
            Layer.provide(Logger.layer([logger]))
          ),
          Logger.layer([logger])
        )
      )
    );
    return warnings;
  });

const dashboardVariantWarning = {
  annotations: { event: "deprecated_dashboard_variant" },
  message: [
    '`dashboardVariant` is deprecated; set `layout: "dashboard"` or `layout: "compact"` instead',
  ],
};

const layoutTable: ReadonlyArray<
  readonly [
    name: string,
    options: Pick<SKHostConfiguration, "dashboardVariant" | "layout">,
    layout: WidgetLayout,
  ]
> = [
  ["neither option", {}, "Compact"],
  ['layout "compact"', { layout: "compact" }, "Compact"],
  ['layout "dashboard"', { layout: "dashboard" }, "Dashboard"],
  ["the deprecated dashboardVariant", { dashboardVariant: true }, "Dashboard"],
  ["dashboardVariant false", { dashboardVariant: false }, "Compact"],
  [
    'layout "compact" over dashboardVariant',
    { dashboardVariant: true, layout: "compact" },
    "Compact",
  ],
  [
    'layout "dashboard" over dashboardVariant false',
    { dashboardVariant: false, layout: "dashboard" },
    "Dashboard",
  ],
];

describe("Layout decoding", () => {
  for (const [name, options, layout] of layoutTable) {
    it.effect(`selects the ${layout} Layout from ${name}`, () =>
      Effect.gen(function* () {
        expect(yield* currentLayout({ apiKey: "api-key", ...options })).toBe(
          layout
        );
      })
    );

    it(`presents a rejected configuration in the ${layout} Layout from ${name}`, () => {
      expect(decodeRejectedConfigurationPresentation(options).layout).toBe(
        layout
      );
    });
  }

  it("lets Borrow through when layout selects the Dashboard Layout", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      dashboardVariant: false,
      layout: "dashboard",
    });

    expect(Result.isFailure(result)).toBe(false);
  });

  it("reports layout as the path when Borrow lacks the Dashboard Layout", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      borrowEnabled: true,
      dashboardVariant: true,
      layout: "compact",
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issues).toEqual(["borrow-requires-dashboard"]);
      expect(result.failure.issuePaths).toEqual(["layout"]);
    }
  });

  it("rejects an unknown layout", () => {
    const result = decodeHostConfiguration({
      apiKey: "api-key",
      layout: "wide",
    } as unknown as SKHostConfiguration);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.issuePaths).toEqual(["layout"]);
    }
  });

  it.effect("warns once that dashboardVariant is deprecated", () =>
    Effect.gen(function* () {
      const warnings = yield* configurationWarnings(
        { apiKey: "api-key", dashboardVariant: true },
        [
          { apiKey: "api-key", dashboardVariant: false },
          { apiKey: "api-key", dashboardVariant: true, hideGasFee: true },
        ]
      );

      expect(warnings).toEqual([dashboardVariantWarning]);
    })
  );

  it.effect("warns once dashboardVariant first appears in an update", () =>
    Effect.gen(function* () {
      const warnings = yield* configurationWarnings(
        { apiKey: "api-key", layout: "dashboard" },
        [{ apiKey: "api-key", dashboardVariant: true }]
      );

      expect(warnings).toEqual([dashboardVariantWarning]);
    })
  );

  it.effect("does not warn without dashboardVariant", () =>
    Effect.gen(function* () {
      const warnings = yield* configurationWarnings(
        { apiKey: "api-key", layout: "dashboard" },
        [{ apiKey: "api-key", layout: "compact" }]
      );

      expect(warnings).toEqual([]);
    })
  );
});
