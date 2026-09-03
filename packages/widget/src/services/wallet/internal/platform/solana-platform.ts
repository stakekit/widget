import { Context, Effect, Layer, Queue, type Scope, Stream } from "effect";
import {
  type HeadlessSolanaRuntime,
  makeDefaultHeadlessSolanaRuntime,
  type SolanaWalletSnapshot,
} from "../runtime/solana-runtime";

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

const makeRuntime = Effect.fn("makeRuntime")(function* (options: {
  readonly includeWalletAdapters: boolean;
}) {
  const runtime = yield* makeDefaultHeadlessSolanaRuntime(options);
  return yield* fromHeadlessRuntime(runtime);
});

export class SolanaPlatform extends Context.Service<
  SolanaPlatform,
  SolanaPlatformService
>()("stakekit/widget/wallet/platform/SolanaPlatform") {
  static readonly layer = Layer.succeed(
    SolanaPlatform,
    SolanaPlatform.of({ makeRuntime })
  );
}
