import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import { WidgetConfigService } from "../../../services/config/widget-config";
import { WidgetNavigation } from "../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowIntake,
  getBorrowReviewTrackingProperties,
  getBorrowTransactionFlowDestination,
} from "../model/session";

/** Validates the intake and navigates to Review carrying a new Session. */
export const startBorrowTransactionFlow = Effect.fn(
  "startBorrowTransactionFlow"
)(function* (intake: BorrowTransactionFlowIntake) {
  const config = yield* WidgetConfigService;
  if (!(yield* config.current).borrowEnabled) {
    return { _tag: "RejectedDisabled" } as const;
  }
  const wallet = yield* WalletService;
  const walletScope = walletScopeFromState((yield* wallet.state).connection);
  if (
    !walletScope ||
    !sameWalletScopeOwner(walletScope, {
      address: intake.command.address,
      network: intake.summary.network,
    })
  ) {
    return { _tag: "RejectedOwner" } as const;
  }

  const session = new BorrowFlowSession({
    intake: { ...intake },
    walletScope: new WalletScopeKey(walletScope),
  });
  const navigation = yield* WidgetNavigation;
  // A started router navigation cannot be cancelled; an interrupted Start
  // waits for it rather than abandoning it mid-flight.
  yield* Effect.uninterruptible(
    navigation.execute({
      _tag: "Push",
      to: getBorrowTransactionFlowDestination(session.intake.entry).review({
        borrowFlowSession: session,
      }),
    })
  );
  const trackingProperties = getBorrowReviewTrackingProperties(session.intake);
  if (trackingProperties) {
    const tracking = yield* TrackingService;
    yield* tracking.trackEvent("borrowReviewClicked", trackingProperties);
  }
  return { _tag: "Started", session } as const;
});

export const startBorrowTransactionFlowAtom = walletRuntime
  .fn((intake: BorrowTransactionFlowIntake) =>
    startBorrowTransactionFlow(intake)
  )
  .pipe(Atom.withLabel("startBorrowTransactionFlowAtom"));

/** How many history entries past the page it started from each page sits. */
const borrowFlowDepth = { Review: 1, Steps: 2 } as const;

/**
 * Leaves the flow for the page it started from, back through the history
 * the flow pushed, so Back from there does not return to the flow. A started
 * router navigation cannot be cancelled, so a page that ends meanwhile waits
 * for it.
 */
export const leaveBorrowFlow = (from: keyof typeof borrowFlowDepth) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(
      navigation.execute({ _tag: "Back", steps: borrowFlowDepth[from] })
    )
  );

/**
 * Opens the page the flow started from afresh in its place, as Done on
 * Complete does for a new action. A started router navigation cannot be
 * cancelled, so a page that ends meanwhile waits for it.
 */
export const restartBorrowFlow = (session: BorrowFlowSession) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(
      navigation.execute({
        _tag: "Replace",
        to: getBorrowTransactionFlowDestination(session.intake.entry).basePath,
      })
    )
  );
