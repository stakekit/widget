import type { Connection } from "@solana/web3.js";
import { Deferred, Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime";
import { makeWalletControllerAtom } from "../../src/features/wallet/wagmi/controller";
import { WalletInitializationKey } from "../../src/features/wallet/wagmi/initialization";
import { LegacyApiService } from "../../src/services/api/legacy-api-service";
import { YieldApiService } from "../../src/services/api/yield-api-service";
import { WalletService } from "../../src/services/wallet/wallet-service";

const initializationKey = new WalletInitializationKey({
  chainIconMapping: undefined,
  disableInjectedProviderDiscovery: true,
  externalProviderInitToken: null,
  forceWalletConnectOnly: false,
  hasExternalProvider: false,
  institutionalWallets: false,
  isLedgerLive: false,
  isSafe: false,
  solanaConnection: {} as Connection,
  solanaWallets: [],
  tonConnectManifestUrl: undefined,
  variant: "default",
});

const makeRuntimeLayer = (
  getEnabledNetworks: () => Effect.Effect<ReadonlySet<"ethereum">, unknown>
) =>
  Layer.mergeAll(
    Layer.succeed(LegacyApiService, { getEnabledNetworks } as never),
    Layer.succeed(YieldApiService, {} as never),
    Layer.succeed(WalletService, {
      persistPublicKey: () => Effect.void,
    } as never)
  );

describe("wallet controller resilience", () => {
  it("exposes the built controller while best-effort initialization is pending and releases it with the atom scope", async () => {
    const initializationRelease = await Effect.runPromise(
      Deferred.make<void>()
    );
    const initializationInterrupted = await Effect.runPromise(
      Deferred.make<void>()
    );
    const configuredController = {
      queryParamsInitChainId: undefined,
      wagmiConfig: { connectors: [{ id: "configured" }] },
    };
    const controllerAtom = makeWalletControllerAtom({
      buildConfig: (() => Effect.succeed(configuredController)) as never,
      initialize: (() =>
        Deferred.await(initializationRelease).pipe(
          Effect.onInterrupt(() =>
            Deferred.succeed(initializationInterrupted, undefined)
          )
        )) as never,
    })(initializationKey);
    const registry = AtomRegistry.make({
      initialValues: [
        [
          appRuntime.layer,
          makeRuntimeLayer(() =>
            Effect.succeed(new Set(["ethereum"]))
          ) as never,
        ],
      ],
    });
    registry.mount(controllerAtom);

    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(controllerAtom))).toBe(
        configuredController
      )
    );
    registry.dispose();
    await Effect.runPromise(Deferred.await(initializationInterrupted));
  });

  it("recovers the same mounted controller after a transient enabled-networks failure", async () => {
    const configuredController = {
      queryParamsInitChainId: undefined,
      wagmiConfig: { connectors: [{ id: "recovered" }] },
    };
    const controllerAtom = makeWalletControllerAtom({
      buildConfig: (() => Effect.succeed(configuredController)) as never,
      initialize: (() => Effect.void) as never,
    })(initializationKey);
    let attempt = 0;
    const getEnabledNetworks = vi.fn(() =>
      Effect.suspend(() => {
        attempt += 1;
        return attempt <= 3
          ? Effect.fail(new Error("temporary enabled-networks failure"))
          : Effect.succeed(new Set(["ethereum"] as const));
      })
    );
    const runtimeLayer = makeRuntimeLayer(getEnabledNetworks);
    const registry = AtomRegistry.make({
      initialValues: [[appRuntime.layer, runtimeLayer as never]],
    });
    registry.mount(controllerAtom);

    await vi.waitFor(() => expect(attempt).toBe(4), { timeout: 3000 });
    expect(AsyncResult.getOrThrow(registry.get(controllerAtom))).toBe(
      configuredController
    );
    expect(attempt).toBe(4);

    registry.dispose();
  });
});
