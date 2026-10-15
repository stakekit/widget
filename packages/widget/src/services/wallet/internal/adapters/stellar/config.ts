import { Effect } from "effect";
import type { Network } from "../../../../../domain/network/network";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { StellarWalletsKitPlatformService } from "../../platform/stellar-wallets-kit-platform";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";

type LoadStellarConnectorOptions = {
  readonly buildConnectors: boolean;
  readonly enabledNetworks: ReadonlySet<Network>;
  readonly runWalletEffect: RunWalletEffect;
  readonly stellarWalletsKitPlatform: StellarWalletsKitPlatformService;
  readonly walletConnectProtocol: WalletConnectProtocol;
};

export const loadStellarConnector = Effect.fn("loadStellarConnector")(
  function* ({
    buildConnectors,
    enabledNetworks,
    runWalletEffect,
    stellarWalletsKitPlatform,
    walletConnectProtocol,
  }: LoadStellarConnectorOptions) {
    if (!buildConnectors || !enabledNetworks.has("stellar")) return null;

    const clients = yield* stellarWalletsKitPlatform.load(
      walletConnectProtocol
    );
    const module = yield* Effect.tryPromise({
      try: () => import("./stellar-connector"),
      catch: (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not load Stellar connectors",
          operation: "stellar-connector-load",
        }),
    });
    return module.getStellarConnectors({ clients, runWalletEffect });
  },
  Effect.catch((error) =>
    Effect.logError("Stellar wallet adapter failed").pipe(
      Effect.annotateLogs({
        event: "stellar_wallet_adapter_failed",
        operation: error.operation,
      }),
      Effect.as(null)
    )
  )
);
