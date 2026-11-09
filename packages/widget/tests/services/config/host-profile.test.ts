import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import type { SKHostConfiguration } from "../../../src/public-api/react-types";
import {
  variantHostProfiles,
  type WidgetVariant,
} from "../../../src/services/config/host-profile";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../../src/services/config/widget-config";

const variants: ReadonlyArray<WidgetVariant> = [
  "default",
  "finery",
  "porto",
  "utila",
  "zerion",
];

const hostConfiguration = (
  variant: WidgetVariant,
  dashboard: boolean
): SKHostConfiguration => {
  const layout = dashboard ? "dashboard" : "compact";
  return variant === "zerion"
    ? { apiKey: "api-key", chainModal: () => null, layout, variant }
    : { apiKey: "api-key", layout, variant };
};

const currentConfig = (configuration: SKHostConfiguration) =>
  WidgetConfigService.use((config) => config.current).pipe(
    Effect.provide(WidgetConfigService.layer(configuration))
  );

describe("Host Profile resolution", () => {
  for (const variant of variants) {
    it.effect(
      `resolves ${variant}'s profile, condensing Earn in the Dashboard Layout`,
      () =>
        Effect.gen(function* () {
          const compact = yield* currentConfig(
            hostConfiguration(variant, false)
          );
          const dashboard = yield* currentConfig(
            hostConfiguration(variant, true)
          );

          expect(compact.variant).toBe(variant);
          expect(compact.hostProfile).toEqual(variantHostProfiles[variant]);
          expect(dashboard.hostProfile).toEqual({
            ...compact.hostProfile,
            earnPresentation: {
              ...compact.hostProfile.earnPresentation,
              condensed: true,
            },
          });
        })
    );
  }

  it.effect("resolves the default profile when the variant is omitted", () =>
    Effect.gen(function* () {
      const config = yield* currentConfig({ apiKey: "api-key" });

      expect(config.hostProfile).toEqual(variantHostProfiles.default);
    })
  );

  it.effect("captures wallet capabilities in the bootstrap snapshot", () =>
    Effect.gen(function* () {
      const porto = selectWidgetBootstrapSnapshot(
        yield* currentConfig(hostConfiguration("porto", false))
      );
      const finery = selectWidgetBootstrapSnapshot(
        yield* currentConfig(hostConfiguration("finery", false))
      );
      const zerion = selectWidgetBootstrapSnapshot(
        yield* currentConfig(hostConfiguration("zerion", false))
      );

      expect(porto.wallet).toMatchObject({
        institutionalWallets: false,
        walletCatalogue: "porto",
      });
      expect(finery.wallet).toMatchObject({
        institutionalWallets: true,
        walletCatalogue: "default",
      });
      expect(zerion.tracking.hostTracking).toBe(true);
      expect(porto.tracking.hostTracking).toBe(false);
    })
  );
});
