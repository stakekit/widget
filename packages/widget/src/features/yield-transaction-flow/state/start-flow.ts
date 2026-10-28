import { Effect } from "effect";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import type { WalletRuntimeInvariantError } from "../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  isYieldTransactionFlowWalletScopeValid,
  makeYieldFlowSession,
  type NavigatingYieldTransactionFlowStart,
  type YieldFlowSession,
} from "../model/yield-transaction-flow";

// Kept apart from `start-atom.ts`: DeepLinkCoordinator, which the wallet
// runtime builds, starts flows too, so importing the runtime here would cycle.

type StartYieldTransactionFlowOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: YieldFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

/**
 * Start: validates the intake and navigates to Review carrying a new
 * Session. Its services resolve once, so a runtime service can build it
 * during Layer construction.
 */
export const makeStartYieldTransactionFlow = Effect.gen(function* () {
  const navigation = yield* WidgetNavigation;
  const wallet = yield* WalletService;

  return Effect.fn("startYieldTransactionFlow")(function* (
    input: NavigatingYieldTransactionFlowStart
  ): Effect.fn.Return<
    StartYieldTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    const walletScope = walletScopeFromState((yield* wallet.state).connection);
    if (
      !walletScope ||
      !isYieldTransactionFlowWalletScopeValid(input.intake, walletScope)
    ) {
      return { _tag: "RejectedOwner" } as const;
    }

    const session = makeYieldFlowSession(input, walletScope);
    // A started router navigation cannot be cancelled; an interrupted Start
    // waits for it rather than abandoning it mid-flight.
    yield* Effect.uninterruptible(
      navigation.execute({
        _tag: "Push",
        to: session.destination.review({ yieldFlowSession: session }),
      })
    );
    return { _tag: "Started", session } as const;
  });
});
