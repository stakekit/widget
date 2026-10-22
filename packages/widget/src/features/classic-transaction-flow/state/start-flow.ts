import { Effect } from "effect";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import type { WalletRuntimeInvariantError } from "../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  type ClassicFlowSession,
  isClassicTransactionFlowWalletScopeValid,
  makeClassicFlowNavigationState,
  makeClassicFlowSession,
  type NavigatingClassicTransactionFlowStart,
} from "../model/classic-transaction-flow";

// Kept apart from `start-atom.ts`: DeepLinkCoordinator, which the wallet
// runtime builds, starts flows too, so importing the runtime here would cycle.

type StartClassicTransactionFlowOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: ClassicFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

/**
 * Start: validates the intake and navigates to Review carrying a new
 * Session. Its services resolve once, so a runtime service can build it
 * during Layer construction.
 */
export const makeStartClassicTransactionFlow = Effect.gen(function* () {
  const navigation = yield* WidgetNavigation;
  const wallet = yield* WalletService;

  return Effect.fn("startClassicTransactionFlow")(function* (
    input: NavigatingClassicTransactionFlowStart
  ): Effect.fn.Return<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    const walletScope = walletScopeFromState((yield* wallet.state).connection);
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
});
