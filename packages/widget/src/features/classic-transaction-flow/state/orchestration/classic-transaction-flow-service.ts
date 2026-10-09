import { Context, Effect, Layer, type Scope } from "effect";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../../services/wallet/wallet-service";
import {
  type ClassicFlowSession,
  isClassicTransactionFlowWalletScopeValid,
  makeClassicFlowNavigationState,
  makeClassicFlowSession,
  type NavigatingClassicTransactionFlowStart,
} from "../../model/classic-transaction-flow";
import {
  type ClassicFlowSessionHandle,
  makeClassicFlowSessionFactory,
} from "./classic-flow-session";

type StartClassicTransactionFlowOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: ClassicFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type ClassicTransactionFlowServiceApi = Readonly<{
  /**
   * Builds the Session's operations in the caller's Scope, which owns the
   * Session: closing it ends the Session and interrupts its work. Each opening
   * is a fresh Session without a reservation. A Session for another Wallet
   * Scope Owner is interrupted.
   */
  readonly openSession: (
    session: ClassicFlowSession
  ) => Effect.Effect<ClassicFlowSessionHandle, never, Scope.Scope>;
  /** Validates the intake and navigates to Review carrying a new Session. */
  readonly start: (
    input: NavigatingClassicTransactionFlowStart
  ) => Effect.Effect<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

const makeClassicTransactionFlowService = Effect.fn(
  "makeClassicTransactionFlowService"
)(function* () {
  const wallet = yield* WalletService;
  const navigation = yield* WidgetNavigation;
  const makeSession = yield* makeClassicFlowSessionFactory();

  const currentWalletScope = wallet.state.pipe(
    Effect.map((state) => walletScopeFromState(state.connection))
  );

  const start = Effect.fn("ClassicTransactionFlowService.start")(function* (
    input: NavigatingClassicTransactionFlowStart
  ): Effect.fn.Return<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    const walletScope = yield* currentWalletScope;
    if (
      !walletScope ||
      !isClassicTransactionFlowWalletScopeValid(input.intake, walletScope)
    ) {
      return { _tag: "RejectedOwner" } as const;
    }

    const session = makeClassicFlowSession(input, walletScope);
    // A started router navigation cannot be cancelled; an interrupted Start
    // waits for it rather than abandoning it mid-flight.
    yield* Effect.uninterruptible(
      navigation.execute({
        _tag: "Push",
        path: session.destination.reviewPath,
        state: makeClassicFlowNavigationState(session),
      })
    );
    return { _tag: "Started", session } as const;
  });

  const openSession = Effect.fn("ClassicTransactionFlowService.openSession")(
    function* (
      session: ClassicFlowSession
    ): Effect.fn.Return<ClassicFlowSessionHandle, never, Scope.Scope> {
      // Data validation, not lifetime: the wallet may have changed between
      // Start and the route mounting this Session.
      const walletScope = yield* currentWalletScope.pipe(Effect.orDie);
      if (
        !isClassicTransactionFlowWalletScopeValid(session.intake, walletScope)
      ) {
        return yield* Effect.interrupt;
      }
      return yield* makeSession(session);
    }
  );

  return { openSession, start } satisfies ClassicTransactionFlowServiceApi;
});

export class ClassicTransactionFlowService extends Context.Service<
  ClassicTransactionFlowService,
  ClassicTransactionFlowServiceApi
>()(
  "stakekit/widget/features/classic-transaction-flow/ClassicTransactionFlowService"
) {
  static readonly layer = Layer.effect(
    ClassicTransactionFlowService,
    makeClassicTransactionFlowService()
  );
}
