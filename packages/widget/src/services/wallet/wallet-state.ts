import {
  Effect,
  Exit,
  Option,
  Schema,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import type { WidgetPersistence } from "../persistence/widget-persistence";
import type { WalletRuntimeInvariantError } from "./domain/errors";
import type { WalletCoreState, WalletState } from "./domain/state";
import type { WagmiCoreObservation } from "./platform/wagmi-platform";
import type { WalletRoutingContext } from "./router";
import { makeCompleteWalletStateStream } from "./state-projection";
import type { WalletController } from "./wagmi-config";

class WalletStateInitializationError extends Schema.TaggedErrorClass<WalletStateInitializationError>()(
  "WalletStateInitializationError",
  { cause: Schema.Defect() }
) {}

export type WalletStateContext = {
  readonly core: WalletCoreState;
  readonly routing: WalletRoutingContext;
  readonly state: WalletState;
};

export type WalletStateRuntime = {
  readonly context: Effect.Effect<
    WalletStateContext,
    WalletRuntimeInvariantError
  >;
  readonly contexts: Stream.Stream<
    WalletStateContext,
    WalletRuntimeInvariantError
  >;
  readonly failInvariant: (
    error: WalletRuntimeInvariantError
  ) => Effect.Effect<void>;
};

const makeContextStream = ({
  controller,
  core,
  readStoredPublicKeys,
}: {
  readonly controller: WalletController;
  readonly core: WalletCoreState;
  readonly readStoredPublicKeys: WidgetPersistence["Service"]["readStoredPublicKeys"];
}) =>
  makeCompleteWalletStateStream({
    controller,
    projection: core,
    readStoredPublicKeys,
  }).pipe(
    Stream.map(
      ({ routing, state }): WalletStateContext => ({
        core,
        routing,
        state,
      })
    )
  );

export const makeWalletStateRuntime = Effect.fn("makeWalletStateRuntime")(
  function* ({
    controller,
    core,
    readStoredPublicKeys,
  }: {
    readonly controller: WalletController;
    readonly core: WagmiCoreObservation;
    readonly readStoredPublicKeys: WidgetPersistence["Service"]["readStoredPublicKeys"];
  }): Effect.fn.Return<
    WalletStateRuntime,
    WalletStateInitializationError,
    Scope.Scope
  > {
    const initialCore = yield* core.current;
    const initialOption = yield* makeContextStream({
      controller,
      core: initialCore,
      readStoredPublicKeys,
    }).pipe(Stream.runHead);
    if (Option.isNone(initialOption)) {
      return yield* new WalletStateInitializationError({
        cause: new Error(
          "Wallet State stream completed before its first value"
        ),
      });
    }

    const current = yield* SubscriptionRef.make<
      Exit.Exit<WalletStateContext, WalletRuntimeInvariantError>
    >(Exit.succeed(initialOption.value));
    const contexts = SubscriptionRef.changes(current).pipe(
      Stream.mapEffect((result) => result)
    );

    yield* core.states.pipe(
      Stream.switchMap((next) =>
        makeContextStream({
          controller,
          core: next,
          readStoredPublicKeys,
        })
      ),
      Stream.runForEach((context) =>
        SubscriptionRef.update(current, (result) =>
          Exit.isFailure(result) ? result : Exit.succeed(context)
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );
    const failInvariant = Effect.fn("failInvariant")(function* (
      error: WalletRuntimeInvariantError
    ) {
      yield* SubscriptionRef.update(current, (result) =>
        Exit.isFailure(result) ? result : Exit.fail(error)
      );
    });

    return {
      context: SubscriptionRef.get(current).pipe(Effect.flatten),
      contexts,
      failInvariant,
    };
  }
);
