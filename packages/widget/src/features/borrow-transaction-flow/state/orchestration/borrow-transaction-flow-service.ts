import { Context, Effect, Layer, type Scope } from "effect";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../../domain/wallet/wallet-scope";
import { WidgetConfigService } from "../../../../services/config/widget-config";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../../services/wallet/wallet-service";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowIntake,
  getBorrowReviewTrackingProperties,
  getBorrowTransactionFlowRoutes,
  makeBorrowFlowNavigationState,
} from "../../model/borrow-transaction-flow";
import {
  type BorrowFlowSessionHandle,
  makeBorrowFlowSessionFactory,
} from "./borrow-flow-session";

type StartBorrowTransactionFlowOutcome =
  | Readonly<{ readonly _tag: "Started"; readonly session: BorrowFlowSession }>
  | Readonly<{ readonly _tag: "RejectedDisabled" }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type BorrowTransactionFlowServiceApi = Readonly<{
  /**
   * Builds the Session's operations in the caller's Scope, which owns the
   * Session: closing it ends the Session and interrupts its work. Each opening
   * is a fresh Session without a reservation, so revisiting Review through
   * browser history reopens Review rather than resuming execution. A Session
   * for another Wallet Scope Owner is interrupted.
   */
  readonly openSession: (
    session: BorrowFlowSession
  ) => Effect.Effect<BorrowFlowSessionHandle, never, Scope.Scope>;
  /** Validates the intake and navigates to Review carrying a new Session. */
  readonly start: (
    intake: BorrowTransactionFlowIntake
  ) => Effect.Effect<
    StartBorrowTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

const makeBorrowTransactionFlowService = Effect.fn(
  "makeBorrowTransactionFlowService"
)(function* () {
  const config = yield* WidgetConfigService;
  const navigation = yield* WidgetNavigation;
  const tracking = yield* TrackingService;
  const wallet = yield* WalletService;
  const makeSession = yield* makeBorrowFlowSessionFactory();

  // The connected Wallet Scope when it belongs to `owner`, otherwise null.
  const ownedWalletScope = Effect.fn(
    "BorrowTransactionFlowService.ownedWalletScope"
  )(function* (owner: Parameters<typeof sameWalletScopeOwner>[1]) {
    const walletScope = walletScopeFromState((yield* wallet.state).connection);
    return walletScope && sameWalletScopeOwner(walletScope, owner)
      ? walletScope
      : null;
  });

  const start = Effect.fn("BorrowTransactionFlowService.start")(function* (
    intake: BorrowTransactionFlowIntake
  ): Effect.fn.Return<
    StartBorrowTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    if (!(yield* config.current).borrowEnabled) {
      return { _tag: "RejectedDisabled" } as const;
    }
    const walletScope = yield* ownedWalletScope({
      address: intake.command.address,
      network: intake.summary.network,
    });
    if (!walletScope) return { _tag: "RejectedOwner" } as const;

    const session = new BorrowFlowSession({
      intake: { ...intake },
      walletScope: new WalletScopeKey(walletScope),
    });
    // A started router navigation cannot be cancelled; an interrupted Start
    // waits for it rather than abandoning it mid-flight.
    yield* Effect.uninterruptible(
      navigation.execute({
        _tag: "Push",
        path: getBorrowTransactionFlowRoutes(session.intake.entry).reviewPath,
        state: makeBorrowFlowNavigationState(session),
      })
    );
    const trackingProperties = getBorrowReviewTrackingProperties(
      session.intake
    );
    if (trackingProperties) {
      yield* tracking.trackEvent("borrowReviewClicked", trackingProperties);
    }
    return { _tag: "Started", session } as const;
  });

  const openSession = Effect.fn("BorrowTransactionFlowService.openSession")(
    function* (
      session: BorrowFlowSession
    ): Effect.fn.Return<BorrowFlowSessionHandle, never, Scope.Scope> {
      // Data validation, not lifetime: the wallet may have changed between
      // Start and the route mounting this Session.
      const owned = yield* ownedWalletScope(session.walletScope).pipe(
        Effect.orDie
      );
      if (!owned) return yield* Effect.interrupt;
      return yield* makeSession(session);
    }
  );

  return { openSession, start } satisfies BorrowTransactionFlowServiceApi;
});

export class BorrowTransactionFlowService extends Context.Service<
  BorrowTransactionFlowService,
  BorrowTransactionFlowServiceApi
>()(
  "stakekit/widget/features/borrow-transaction-flow/BorrowTransactionFlowService"
) {
  static readonly layer = Layer.effect(
    BorrowTransactionFlowService,
    makeBorrowTransactionFlowService()
  );
}
