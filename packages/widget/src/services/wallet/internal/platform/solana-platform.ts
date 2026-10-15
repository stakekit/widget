import {
  Context,
  Effect,
  FiberSet,
  Layer,
  Queue,
  type Scope,
  Stream,
} from "effect";
import {
  type HeadlessSolanaRuntime,
  makeDefaultHeadlessSolanaRuntime,
  type SolanaWalletSnapshot,
} from "../runtime/solana-runtime";
import { WalletConnectProtocolPlatform } from "./wallet-connect-protocol";

export type SolanaRuntime = {
  readonly connection: HeadlessSolanaRuntime["connection"];
  readonly current: Effect.Effect<SolanaWalletSnapshot>;
  readonly states: Stream.Stream<SolanaWalletSnapshot>;
};

type SolanaPlatformService = {
  readonly makeRuntime: (options: {
    readonly includeWalletAdapters: boolean;
  }) => Effect.Effect<SolanaRuntime, never, Scope.Scope>;
};

const fromHeadlessRuntime = Effect.fn("fromHeadlessRuntime")(function* (
  runtime: HeadlessSolanaRuntime
) {
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
  } satisfies SolanaRuntime;
});

export class SolanaPlatform extends Context.Service<
  SolanaPlatform,
  SolanaPlatformService
>()("stakekit/widget/wallet/platform/SolanaPlatform") {
  static readonly layer = Layer.effect(
    SolanaPlatform,
    Effect.gen(function* () {
      const protocolPlatform = yield* WalletConnectProtocolPlatform;
      const makeRuntime = Effect.fn("SolanaPlatform.makeRuntime")(
        function* (options: { readonly includeWalletAdapters: boolean }) {
          const walletConnectProtocol = yield* protocolPlatform.make;
          const runWalletEffect = yield* FiberSet.makeRuntimePromise();
          const runtime = yield* makeDefaultHeadlessSolanaRuntime({
            ...options,
            walletConnectProtocol,
            runWalletEffect,
          });
          return yield* fromHeadlessRuntime(runtime);
        }
      );
      return SolanaPlatform.of({ makeRuntime });
    })
  );
}
