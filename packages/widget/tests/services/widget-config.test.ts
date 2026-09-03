import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Result, Stream } from "effect";
import type { SKHostConfiguration } from "../../src/public-api/react-types";
import type { SettingsProps } from "../../src/public-api/types";
import {
  diffWidgetWalletConfig,
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { InvalidHostConfiguration } from "../../src/services/config/widget-config-boundary";

const walletTopology = (overrides: Partial<SKHostConfiguration> = {}) => {
  return Effect.gen(function* () {
    const config = yield* WidgetConfigService;
    const settings = yield* config.current;

    return selectWidgetBootstrapSnapshot(settings).wallet;
  }).pipe(
    Effect.provide(
      WidgetConfigService.layer({
        ...overrides,
        apiKey: "api-key",
        variant: "default",
      })
    )
  );
};

describe("WidgetConfigService", () => {
  it.effect(
    "normalizes Host Configuration into one complete Widget Configuration",
    () =>
      Effect.gen(function* () {
        const current = yield* WidgetConfigService.use(
          (config) => config.current
        ).pipe(
          Effect.provide(
            WidgetConfigService.layer({
              apiKey: "api-key",
              dashboardVariant: true,
              dashboardYieldCategoryOrder: ["stake", "stake", "rwa"],
              preferredTokenYieldsPerNetwork: {
                ethereum: {
                  "ETHEREUM-ETH": "ethereum-eth-native-staking",
                },
              },
              variant: "default",
            })
          )
        );

        expect(current).toMatchObject({
          baseUrl: "https://api.stakek.it/",
          borrowApiUrl: "https://borrow.yield.xyz",
          borrowEnabled: false,
          dashboardVariant: true,
          dashboardYieldCategoryOrder: ["stake", "rwa", "defi"],
          disableAutoScrollToTop: false,
          disableInitLayoutAnimation: false,
          disableInjectedProviderDiscovery: false,
          disableResizingInputFontSize: false,
          hideAccountAndChainSelector: false,
          hideChainSelector: false,
          hideNetworkLogo: false,
          institutionalWallets: false,
          isSafe: false,
          mountAnimationStartsFinished: true,
          preferredTokenYieldsPerNetwork: {
            ethereum: {
              "ethereum-eth": "ethereum-eth-native-staking",
            },
          },
          yieldGrouping: "category",
          yieldsApiUrl: "https://api.yield.xyz/",
        });
      })
  );

  it.effect(
    "fails startup when initial Host Configuration is semantically invalid",
    () =>
      Effect.gen(function* () {
        const result = yield* WidgetConfigService.use(
          (config) => config.current
        ).pipe(
          Effect.provide(
            WidgetConfigService.layer({
              apiKey: "api-key",
              borrowEnabled: true,
              variant: "default",
            })
          ),
          Effect.result
        );

        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(result.failure).toBeInstanceOf(InvalidHostConfiguration);
          expect(result.failure.issues).toEqual(["borrow-requires-dashboard"]);
        }
      })
  );

  it.effect(
    "canonicalizes external-provider chains and resolved Borrow API URLs",
    () =>
      Effect.gen(function* () {
        const provider = {
          sendTransaction: async () => "hash",
          signMessage: async () => "0xSignature",
          switchChain: async () => {},
        };
        const current = yield* WidgetConfigService.use(
          (config) => config.current
        ).pipe(
          Effect.provide(
            WidgetConfigService.layer({
              apiKey: "api-key",
              borrowApiUrl: "  https://borrow.example.com///  ",
              externalProviders: {
                currentAddress: "0xWallet",
                provider,
                supportedChainIds: [137, 1, 137, 10],
                type: "generic",
              },
              variant: "default",
            })
          )
        );

        expect(current.borrowApiUrl).toBe("https://borrow.example.com");
        expect(current.externalProviders?.supportedChainIds).toEqual([
          1, 10, 137,
        ]);
        expect(current.externalProviders?.provider).toBe(provider);
      })
  );

  it.effect("normalizes validator policy addresses by network identity", () =>
    Effect.gen(function* () {
      const current = yield* WidgetConfigService.use(
        (config) => config.current
      ).pipe(
        Effect.provide(
          WidgetConfigService.layer({
            apiKey: "api-key",
            validatorsConfig: {
              cosmos: {
                blocked: ["CosmosValidator", "cosmosvalidator"],
              },
              ethereum: {
                allowed: ["0xAbC", "0xabc"],
                blocked: ["0xDeF", "0xdef"],
                preferred: ["0xF00", "0xf00"],
              },
            },
            variant: "default",
          })
        )
      );

      expect(current.validatorsConfig).toBeInstanceOf(Map);
      expect(current.validatorsConfig.get("cosmos")).toEqual({
        allowed: undefined,
        blocked: new Set(["CosmosValidator", "cosmosvalidator"]),
        mergePreferredWithDefault: true,
        preferred: undefined,
        preferredOnly: false,
      });
      expect(current.validatorsConfig.get("ethereum")).toEqual({
        allowed: new Set(["0xabc"]),
        blocked: new Set(["0xdef"]),
        mergePreferredWithDefault: true,
        preferred: new Set(["0xf00"]),
        preferredOnly: false,
      });
    })
  );

  it.effect(
    "publishes the current value immediately and valid dynamic updates",
    () =>
      Effect.gen(function* () {
        const values = yield* Effect.gen(function* () {
          const config = yield* WidgetConfigService;
          const collected = yield* config.values.pipe(
            Stream.take(2),
            Stream.runCollect,
            Effect.forkScoped({ startImmediately: true })
          );

          yield* Effect.yieldNow;
          const outcome = yield* config.update({
            apiKey: "api-key",
            borrowEnabled: true,
            dashboardVariant: true,
            variant: "default",
          });
          const values = yield* Fiber.join(collected);

          return { outcome, values };
        }).pipe(
          Effect.provide(
            WidgetConfigService.layer({ apiKey: "api-key", variant: "default" })
          ),
          Effect.scoped
        );

        expect(values.outcome).toEqual({ _tag: "Updated" });
        expect(values.values.map((value) => value.borrowEnabled)).toEqual([
          false,
          true,
        ]);
      })
  );

  it.effect(
    "rejects semantically invalid updates and retains the last valid value",
    () =>
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const config = yield* WidgetConfigService;
          const outcome = yield* config.update({
            apiKey: "api-key",
            borrowEnabled: true,
            variant: "default",
          });
          const current = yield* config.current;

          return { current, outcome };
        }).pipe(
          Effect.provide(
            WidgetConfigService.layer({ apiKey: "api-key", variant: "default" })
          )
        );

        expect(result.outcome._tag).toBe("RejectedInvalid");
        expect(result.current.apiKey).toBe("api-key");
      })
  );

  it.effect(
    "rejects structurally invalid updates and retains the last valid value",
    () =>
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const config = yield* WidgetConfigService;
          const outcome = yield* config.update({
            apiKey: "api-key",
            hideNetworkLogo: "yes",
            variant: "default",
          } as unknown as SKHostConfiguration);
          const current = yield* config.current;

          return { current, outcome };
        }).pipe(
          Effect.provide(
            WidgetConfigService.layer({ apiKey: "api-key", variant: "default" })
          )
        );

        expect(result.outcome).toMatchObject({
          _tag: "RejectedInvalid",
          error: {
            issuePaths: ["hideNetworkLogo"],
            issues: ["host-configuration-decode-failed"],
          },
        });
        expect(result.current.hideNetworkLogo).toBe(false);
      })
  );

  it.effect("treats a changed host function identity as an update", () =>
    Effect.gen(function* () {
      const first: NonNullable<SettingsProps["mapWalletFn"]> = (wallet) =>
        wallet;
      const second: NonNullable<SettingsProps["mapWalletFn"]> = (wallet) =>
        wallet;
      const result = yield* WidgetConfigService.use((config) =>
        Effect.gen(function* () {
          const outcome = yield* config.update({
            apiKey: "api-key",
            mapWalletFn: second,
            variant: "default",
          });
          const current = yield* config.current;
          return { current, outcome };
        })
      ).pipe(
        Effect.provide(
          WidgetConfigService.layer({
            apiKey: "api-key",
            mapWalletFn: first,
            variant: "default",
          })
        )
      );

      expect(result.outcome).toEqual({ _tag: "Updated" });
      expect(result.current.mapWalletFn).toBe(second);
    })
  );

  it.effect("applies a changed API key as an ordinary update", () =>
    Effect.gen(function* () {
      const result = yield* Effect.gen(function* () {
        const config = yield* WidgetConfigService;
        const update = yield* config.update({
          apiKey: "different-api-key",
          variant: "default",
        });
        const current = yield* config.current;

        return { current, update };
      }).pipe(
        Effect.provide(
          WidgetConfigService.layer({ apiKey: "api-key", variant: "default" })
        )
      );

      expect(result.update).toEqual({ _tag: "Updated" });
      expect(result.current.apiKey).toBe("different-api-key");
    })
  );
});

describe("wallet topology difference", () => {
  it.effect(
    "reports nothing for separately built but equal configurations",
    () =>
      Effect.gen(function* () {
        const difference = diffWidgetWalletConfig(
          yield* walletTopology({ chainIconMapping: { ethereum: "eth.svg" } }),
          yield* walletTopology({ chainIconMapping: { ethereum: "eth.svg" } })
        );

        expect(difference).toEqual({ material: [], opaque: [] });
      })
  );

  it.effect("reports a comparable field as material", () =>
    Effect.gen(function* () {
      const difference = diffWidgetWalletConfig(
        yield* walletTopology({ isSafe: true }),
        yield* walletTopology()
      );

      expect(difference.material).toEqual(["isSafe"]);
      expect(difference.opaque).toEqual([]);
    })
  );

  it.effect("reports record mappings by value", () =>
    Effect.gen(function* () {
      const difference = diffWidgetWalletConfig(
        yield* walletTopology({ chainIconMapping: { ethereum: "next.svg" } }),
        yield* walletTopology({ chainIconMapping: { ethereum: "eth.svg" } })
      );

      expect(difference.material).toEqual(["chainIconMapping"]);
      expect(difference.opaque).toEqual([]);
    })
  );

  it.effect("reports host functions as opaque rather than material", () =>
    Effect.gen(function* () {
      const difference = diffWidgetWalletConfig(
        yield* walletTopology({
          chainIconMapping: () => "eth.svg",
          mapWalletFn: (
            wallet: Parameters<NonNullable<SettingsProps["mapWalletFn"]>>[0]
          ) => wallet,
        }),
        yield* walletTopology({
          chainIconMapping: () => "eth.svg",
          mapWalletFn: (
            wallet: Parameters<NonNullable<SettingsProps["mapWalletFn"]>>[0]
          ) => wallet,
        })
      );

      expect(difference.material).toEqual([]);
      expect(difference.opaque).toEqual(["chainIconMapping", "mapWalletFn"]);
    })
  );

  it.effect(
    "separates a material change from a simultaneous function change",
    () =>
      Effect.gen(function* () {
        const difference = diffWidgetWalletConfig(
          yield* walletTopology({
            isSafe: true,
            mapWalletFn: (wallet) => wallet,
          }),
          yield* walletTopology({
            isSafe: false,
            mapWalletFn: (wallet) => wallet,
          })
        );

        expect(difference.material).toEqual(["isSafe"]);
        expect(difference.opaque).toEqual(["mapWalletFn"]);
      })
  );
});
