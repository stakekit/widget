import { Effect, Schema } from "effect";
import type { Connector, createConfig } from "wagmi";
import { configMeta as safeConfigMeta } from "../adapters/safe/safe-connector-meta";
import { WagmiOperations } from "../platform/wagmi-operations";

class WalletInitialConnectionError extends Schema.TaggedError<WalletInitialConnectionError>()(
  "WalletInitialConnectionError",
  {
    cause: Schema.Defect(),
    operation: Schema.Literals(["connect", "reconnect", "switch-chain"]),
  }
) {}

export type WalletInitialConnectionInput = {
  readonly hasExternalProvider: boolean;
  readonly isLedgerDappBrowser: boolean;
  readonly isMobileWallet: boolean;
  readonly queryParamsInitChainId: number | undefined;
  readonly wagmiConfig: ReturnType<typeof createConfig>;
};

export const makeInitializeWallet = Effect.gen(function* () {
  const operations = yield* WagmiOperations;
  const recover = Effect.fn("recover")(function* (
    error: WalletInitialConnectionError
  ) {
    yield* Effect.logWarning("Initial wallet connection operation failed").pipe(
      Effect.annotateLogs({
        cause: error.cause,
        operation: error.operation,
      })
    );
  });

  return Effect.fn("initializeWallet")(function* ({
    hasExternalProvider,
    isLedgerDappBrowser,
    isMobileWallet,
    queryParamsInitChainId,
    wagmiConfig,
  }: WalletInitialConnectionInput) {
    const reconnectedCount = yield* operations.reconnect(wagmiConfig).pipe(
      Effect.mapError(
        (error) =>
          new WalletInitialConnectionError({
            cause: error.cause,
            operation: "reconnect",
          })
      ),
      Effect.catch((error) => recover(error).pipe(Effect.as([]))),
      Effect.map((connections) => connections.length)
    );

    if (
      !hasExternalProvider &&
      reconnectedCount === 0 &&
      !isLedgerDappBrowser &&
      isMobileWallet
    ) {
      const injectedConnector = wagmiConfig.connectors.find(
        (connector: Connector) =>
          connector.id === "injected" || connector.id === safeConfigMeta.id
      );
      if (injectedConnector) {
        yield* operations
          .connect(wagmiConfig, {
            connector: injectedConnector,
            chainId: queryParamsInitChainId,
          })
          .pipe(
            Effect.mapError(
              (error) =>
                new WalletInitialConnectionError({
                  cause: error.cause,
                  operation: "connect",
                })
            ),
            Effect.catch(recover)
          );
      }
    }

    if (
      queryParamsInitChainId &&
      wagmiConfig.state.chainId !== queryParamsInitChainId
    ) {
      yield* operations
        .switchChain(wagmiConfig, {
          chainId: queryParamsInitChainId,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new WalletInitialConnectionError({
                cause: error.cause,
                operation: "switch-chain",
              })
          ),
          Effect.catch(recover)
        );
    }
  });
});
