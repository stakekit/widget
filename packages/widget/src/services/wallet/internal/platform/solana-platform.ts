import {
  Context,
  Effect,
  FiberSet,
  Layer,
  Queue,
  type Scope,
  Stream,
} from "effect";

import { WalletIntegrationError } from "../../wallet-errors";
import type {
  HeadlessSolanaRuntime,
  SolanaWalletSnapshot,
} from "../runtime/solana-runtime";
import { WalletConnectProtocolPlatform } from "./wallet-connect-protocol";

export type SolanaRuntime = {
  readonly connection: HeadlessSolanaRuntime["connection"];
  readonly current: Effect.Effect<SolanaWalletSnapshot>;
  readonly states: Stream.Stream<SolanaWalletSnapshot>;
};

type SolanaPlatformService = {
  readonly makeRuntime: Effect.Effect<
    SolanaRuntime,
    WalletIntegrationError,
    Scope.Scope
  >;
};

const fromHeadlessRuntime = (runtime: HeadlessSolanaRuntime): SolanaRuntime => {
  const changes = Stream.callback<SolanaWalletSnapshot>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const publish = () => {
            Queue.offerUnsafe(queue, runtime.getWalletSnapshot());
          };
          const unsubscribe = runtime.subscribe(publish);
          publish();
          return unsubscribe;
        }),
        (unsubscribe) =>
          Effect.sync(() => {
            unsubscribe();
          })
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

  return {
    connection: runtime.connection,
    current: Effect.sync(runtime.getWalletSnapshot),
    states: changes,
  };
};

export class SolanaPlatform extends Context.Service<
  SolanaPlatform,
  SolanaPlatformService
>()(
  "@stakekit/widget/services/wallet/internal/platform/solana-platform/SolanaPlatform"
) {
  static readonly layer = Layer.effect(
    SolanaPlatform,
    Effect.gen(function* () {
      const protocolPlatform = yield* WalletConnectProtocolPlatform;
      // `@solana/web3.js` and the wallet adapters load only for a topology
      // that offers Solana wallets, never with the initial download.
      const makeRuntime = Effect.gen(function* () {
        const { makeDefaultHeadlessSolanaRuntime } = yield* Effect.tryPromise({
          try: () => import("../runtime/solana-runtime"),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "Could not load Solana wallet support",
              operation: "solana-runtime",
            }),
        });
        const walletConnectProtocol = yield* protocolPlatform.make;
        const runWalletEffect = yield* FiberSet.makeRuntimePromise();
        const runtime = yield* makeDefaultHeadlessSolanaRuntime({
          walletConnectProtocol,
          runWalletEffect,
        });
        return fromHeadlessRuntime(runtime);
      }).pipe(Effect.withSpan("SolanaPlatform.makeRuntime"));
      return SolanaPlatform.of({ makeRuntime });
    })
  );
}
