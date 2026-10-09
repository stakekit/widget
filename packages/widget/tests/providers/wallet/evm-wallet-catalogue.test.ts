import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, type Scope } from "effect";
import { vi } from "vitest";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getConfig } from "../../../src/services/wallet/internal/adapters/evm/config";
import { WalletConnectPresentationPlatform } from "../../../src/services/wallet/internal/platform/wallet-connect-presentation";
import {
  type ConnectorWithWalletDetails,
  connectorsForWallets,
} from "../../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { runWalletEffect } from "../../utils/run-wallet-effect";

const makeCatalogue = Effect.gen(function* () {
  const platform = yield* WalletConnectPresentationPlatform;
  const walletConnectPresentation = yield* platform.make;
  const catalogue = yield* getConfig({
    enabledNetworks: new Set(["ethereum"]),
    institutionalWallets: false,
    variant: "default",
    walletConnectPresentation,
    runWalletEffect,
  });
  if (!catalogue.connector) return yield* Effect.die("EVM catalogue missing");

  return createConfig({
    chains: [mainnet],
    connectors: connectorsForWallets([catalogue.connector], {
      appName: "StakeKit",
      appUrl: "https://stakek.it",
      projectId: "project-id",
    }),
    multiInjectedProviderDiscovery: false,
    storage: null,
    transports: { [mainnet.id]: http() },
  }).connectors as ReadonlyArray<ConnectorWithWalletDetails>;
});

const browserWallet = (connectors: ReadonlyArray<ConnectorWithWalletDetails>) =>
  connectors.find((connector) => connector.walletDetails?.id === "injected");

const detect = (connector: ConnectorWithWalletDetails | undefined) => {
  const availability = connector?.walletDetails?.availability;
  return availability?._tag === "Injected"
    ? availability.detect
    : Effect.die("Browser Wallet is not an injected wallet");
};

const withCatalogue = <A, E>(
  effect: Effect.Effect<A, E, WalletConnectPresentationPlatform | Scope.Scope>
) =>
  effect.pipe(
    Effect.scoped,
    Effect.provide(
      WalletConnectPresentationPlatform.layer.pipe(
        Layer.provide(WalletModal.layer)
      )
    )
  );

describe("default EVM wallet catalogue", () => {
  it.effect("connects named wallets without installed extensions", () =>
    withCatalogue(
      Effect.gen(function* () {
        const connectors = yield* makeCatalogue;

        expect(
          connectors.map(({ walletDetails }) => [
            walletDetails?.id,
            walletDetails?.availability._tag,
          ])
        ).toEqual([
          ["metaMask", "Remote"],
          ["injected", "Injected"],
          ["walletConnect", "Remote"],
          ["coinbase", "Remote"],
          ["ledger", "Remote"],
        ]);
      })
    )
  );

  it.effect("detects the browser wallet while a provider is injected", () =>
    withCatalogue(
      Effect.gen(function* () {
        const connectors = yield* makeCatalogue;
        const window: { ethereum?: unknown } = {};
        vi.stubGlobal("window", window);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => vi.unstubAllGlobals())
        );

        expect(yield* detect(browserWallet(connectors))).toBe(false);
        window.ethereum = { request: async () => [] };
        expect(yield* detect(browserWallet(connectors))).toBe(true);
      })
    )
  );

  it.effect(
    "reports the browser wallet as not available when its provider is gone",
    () =>
      withCatalogue(
        Effect.gen(function* () {
          const connectors = yield* makeCatalogue;
          vi.stubGlobal("window", {});
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => vi.unstubAllGlobals())
          );

          const connector = browserWallet(connectors);
          if (!connector) return yield* Effect.die("Browser Wallet missing");
          const failure = yield* Effect.promise(() =>
            connector.connect().then(
              () => undefined,
              (error: unknown) => error
            )
          );
          expect(failure).toEqual(
            new WalletNotAvailableError({ walletId: "injected" })
          );
        })
      )
  );
});
