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
  earnPresentation: { condensed: false, zerion: false },
  forcesInstitutionalWallets: false,
  hidesEarnLoadingSpinner: false,
  hidesHeaderWalletControl: false,
  hostTokenIconMapping: false,
  hostTracking: false,
  requiresTermsAcknowledgement: false,
  showsPendingApprovalsNotice: false,
  translationOverlay: "none",
  walletCatalogue: "default",
};

const compact = { condensed: true, zerion: false } as const;

const resolutionTable: ReadonlyArray<
  readonly [WidgetVariant, boolean, HostProfile]
> = [
  ["default", false, standard],
  ["default", true, { ...standard, earnPresentation: compact }],
  ["finery", false, { ...standard, forcesInstitutionalWallets: true }],
  [
    "finery",
    true,
    {
      ...standard,
      earnPresentation: compact,
      forcesInstitutionalWallets: true,
    },
  ],
  [
    "porto",
    false,
    { ...standard, earnPresentation: compact, walletCatalogue: "porto" },
  ],
  [
    "porto",
    true,
    { ...standard, earnPresentation: compact, walletCatalogue: "porto" },
  ],
  [
    "utila",
    false,
    {
      ...standard,
      earnPresentation: compact,
      requiresTermsAcknowledgement: true,
      showsPendingApprovalsNotice: true,
      translationOverlay: "utila",
    },
  ],
  [
    "utila",
    true,
    {
      ...standard,
      earnPresentation: compact,
      requiresTermsAcknowledgement: true,
      showsPendingApprovalsNotice: true,
      translationOverlay: "utila",
    },
  ],
  [
    "zerion",
    false,
    {
      ...standard,
      earnPresentation: { condensed: false, zerion: true },
      hidesEarnLoadingSpinner: true,
      hidesHeaderWalletControl: true,
      hostTokenIconMapping: true,
      hostTracking: true,
    },
  ],
  [
    "zerion",
    true,
    {
      ...standard,
      earnPresentation: { condensed: true, zerion: true },
      hidesEarnLoadingSpinner: true,
      hidesHeaderWalletControl: true,
      hostTokenIconMapping: true,
      hostTracking: true,
    },
  ],
];

const hostConfiguration = (
  variant: WidgetVariant,
  dashboardVariant: boolean
): SKHostConfiguration =>
  variant === "zerion"
    ? { apiKey: "api-key", chainModal: () => null, dashboardVariant, variant }
    : { apiKey: "api-key", dashboardVariant, variant };

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
