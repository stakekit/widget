import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { SKHostConfiguration } from "../../../src/public-api/react-types";
import type {
  HostProfile,
  WidgetVariant,
} from "../../../src/services/config/host-profile";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../../src/services/config/widget-config";

const standard: HostProfile = {
  appearancePreset: "default",
  earnPresentation: { condensed: false, zerion: false },
  forcesInstitutionalWallets: false,
  hidesHeaderWalletControl: false,
  hostTokenIconMapping: false,
  hostTracking: false,
  presentation: {},
  requiresTermsAcknowledgement: false,
  showsPendingApprovalsNotice: false,
  translationOverlay: "none",
  walletCatalogue: "default",
};

const compact = { condensed: true, zerion: false } as const;

const finery: HostProfile = {
  ...standard,
  appearancePreset: "finery",
  forcesInstitutionalWallets: true,
  presentation: { surfaceStyle: "elevated", tabsIndicator: "underline" },
};

const porto: HostProfile = {
  ...standard,
  appearancePreset: "porto",
  earnPresentation: compact,
  presentation: {
    callToActionSize: "md",
    surfaceStyle: "outlined",
    tabsIndicator: "pill",
  },
  walletCatalogue: "porto",
};

const utila: HostProfile = {
  ...standard,
  appearancePreset: "utila",
  earnPresentation: compact,
  presentation: {
    callToActionSize: "md",
    gutter: "md",
    surfaceStyle: "outlined",
    tabsIndicator: "tint",
  },
  requiresTermsAcknowledgement: true,
  showsPendingApprovalsNotice: true,
  translationOverlay: "utila",
};

const zerion: HostProfile = {
  ...standard,
  earnPresentation: { condensed: false, zerion: true },
  hidesHeaderWalletControl: true,
  hostTokenIconMapping: true,
  hostTracking: true,
};

const resolutionTable: ReadonlyArray<
  readonly [WidgetVariant, boolean, HostProfile]
> = [
  ["default", false, standard],
  ["default", true, { ...standard, earnPresentation: compact }],
  ["finery", false, finery],
  ["finery", true, { ...finery, earnPresentation: compact }],
  ["porto", false, porto],
  ["porto", true, porto],
  ["utila", false, utila],
  ["utila", true, utila],
  ["zerion", false, zerion],
  [
    "zerion",
    true,
    { ...zerion, earnPresentation: { condensed: true, zerion: true } },
  ],
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
  for (const [variant, dashboardVariant, profile] of resolutionTable) {
    it.effect(
      `resolves ${variant}${dashboardVariant ? " with dashboard" : ""}`,
      () =>
        Effect.gen(function* () {
          const config = yield* currentConfig(
            hostConfiguration(variant, dashboardVariant)
          );

          expect(config.variant).toBe(variant);
          expect(config.hostProfile).toEqual(profile);
        })
    );
  }

  it.effect("resolves the default profile when the variant is omitted", () =>
    Effect.gen(function* () {
      const config = yield* currentConfig({ apiKey: "api-key" });

      expect(config.hostProfile).toEqual(standard);
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
