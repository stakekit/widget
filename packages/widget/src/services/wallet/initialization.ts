import { Data, Effect, Semaphore } from "effect";
import type { Connector, createConfig } from "wagmi";
import {
  isLedgerDappBrowserProvider,
  isMobileWalletEnvironment,
} from "./browser-environment";
import { configMeta as safeConfigMeta } from "./connectors/safe/safe-connector-meta";
import {
  type WagmiActionOperations,
  wagmiActionOperations,
} from "./wagmi-actions";

export class WalletInitializationError extends Data.TaggedError(
  "WalletInitializationError"
)<{
  readonly cause: unknown;
  readonly phase:
    | "configuration"
    | "initial-chain-switch"
    | "mobile-fallback-connect"
    | "reconnect";
}> {}

export type WalletInitializationOperations = Pick<
  WagmiActionOperations,
  "connect" | "reconnect" | "switchChain"
> & {
  readonly isLedgerLive: () => boolean;
  readonly isMobile: () => boolean;
};

const defaultOperations: WalletInitializationOperations = {
  connect: wagmiActionOperations.connect,
  isLedgerLive: isLedgerDappBrowserProvider,
  isMobile: isMobileWalletEnvironment,
  reconnect: wagmiActionOperations.reconnect,
  switchChain: wagmiActionOperations.switchChain,
};

const wagmiReconnectSemaphore = Semaphore.makeUnsafe(1);

const runSerializedReconnect = <A>(reconnect: () => Promise<A>) =>
  Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      yield* restore(wagmiReconnectSemaphore.take(1));
      const releasePermit = () =>
        Effect.runSync(wagmiReconnectSemaphore.release(1));
      const reconnectPromise = yield* Effect.try({
        try: () => reconnect().finally(releasePermit),
        catch: (cause) => {
          releasePermit();
          return cause;
        },
      });

      return yield* restore(
        Effect.tryPromise({
          try: () => reconnectPromise,
          catch: (cause) => cause,
        })
      );
    })
  );

export const initializeWallet = Effect.fn("initializeWallet")(function* ({
  hasExternalProvider,
  isLedgerDappBrowser,
  isMobileWallet,
  operations = defaultOperations,
  queryParamsInitChainId,
  wagmiConfig,
}: {
  readonly hasExternalProvider: boolean;
  readonly isLedgerDappBrowser?: boolean;
  readonly isMobileWallet?: boolean;
  readonly operations?: WalletInitializationOperations;
  readonly queryParamsInitChainId: number | undefined;
  readonly wagmiConfig: ReturnType<typeof createConfig>;
}) {
  const reconnectedCount = yield* runSerializedReconnect(() =>
    operations.reconnect(wagmiConfig)
  ).pipe(
    Effect.mapError(
      (cause) => new WalletInitializationError({ cause, phase: "reconnect" })
    ),
    Effect.match({
      onFailure: () => 0,
      onSuccess: (connections) => connections.length,
    })
  );

  if (
    !hasExternalProvider &&
    reconnectedCount === 0 &&
    !(isLedgerDappBrowser ?? operations.isLedgerLive()) &&
    (isMobileWallet ?? operations.isMobile())
  ) {
    const injectedConnector = wagmiConfig.connectors.find(
      (connector: Connector) =>
        connector.id === "injected" || connector.id === safeConfigMeta.id
    );

    if (injectedConnector) {
      yield* Effect.tryPromise({
        try: () =>
          operations.connect(wagmiConfig, {
            connector: injectedConnector,
            chainId: queryParamsInitChainId,
          }),
        catch: (cause) =>
          new WalletInitializationError({
            cause,
            phase: "mobile-fallback-connect",
          }),
      }).pipe(Effect.ignore);
    }
  }

  if (
    queryParamsInitChainId &&
    wagmiConfig.state.chainId !== queryParamsInitChainId
  ) {
    yield* Effect.tryPromise({
      try: () =>
        operations.switchChain(wagmiConfig, {
          chainId: queryParamsInitChainId,
        }),
      catch: (cause) =>
        new WalletInitializationError({
          cause,
          phase: "initial-chain-switch",
        }),
    }).pipe(Effect.ignore);
  }
});
