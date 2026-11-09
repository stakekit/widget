import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type { ActionId } from "../../../domain/borrow/ids";
import { isBorrowNetwork } from "../../../domain/borrow/network";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../resources/borrow-markets/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../resources/borrow-positions/index";
import { WidgetNavigation } from "../../../services/navigation/widget-navigation";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../services/navigation/widget-routes";
import { BorrowTransactionWorkflowInput } from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  makeTransactionFlowWorkflowAtoms,
  startTransactionFlowExecution,
} from "../../transaction-flow/index";
import { settleBorrowPosition } from "../model/borrow-completion";
import {
  emptyBorrowExecutionView,
  projectBorrowExecution,
} from "../model/borrow-transaction-workflow";
import type { BorrowFlowSession } from "../model/session";
import { leaveBorrowFlow, restartBorrowFlow } from "./borrow-flow-session";

/**
 * Starts the workflow for `actionId`, in the caller's Scope, if that action is
 * waiting in the Session; see `startTransactionFlowExecution`.
 */
export const startBorrowFlowExecution = Effect.fn("startBorrowFlowExecution")(
  function* ({ handoff, walletScope }: BorrowFlowSession, actionId: ActionId) {
    return yield* startTransactionFlowExecution(
      handoff,
      (waiting) => waiting.action.id === actionId,
      ({ action }) =>
        new BorrowTransactionWorkflowInput({ action, walletScope })
    );
  }
);

/** The market position the flow acts on: its page's own, else the action's. */
const getBorrowFlowPositionMarketId = ({
  intake: { command, entry },
}: BorrowFlowSession) =>
  entry._tag === "MarketPosition" ? entry.marketId : command.args.marketId;

const replaceBorrowFlowPage = (to: WidgetPath) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(navigation.execute({ _tag: "Replace", to }))
  );

/**
 * The Session market's position once the Borrow API reports it after the
 * action. Cached positions may predate the action, and the workflow's
 * invalidation can land after completion renders, so reading starts its own
 * refresh and reports nothing until that fetch finishes. From then on it
 * follows the resource, so a failed fetch settles on a later refresh.
 */
export const makeBorrowFlowSettledPositionAtom = (
  session: BorrowFlowSession
) => {
  const { network } = session.walletScope;
  const positionsAtom = borrowPositionsResourceAtom.foreground(
    new BorrowPositionsKey({ scope: session.walletScope })
  );
  const marketsAtom = isBorrowNetwork(network)
    ? borrowMarketsResourceAtom.foreground(
        new BorrowMarketsKey({ network, scope: "all" })
      )
    : null;
  const { command, summary } = session.intake;
  // Reads positions only once, so later results never retrigger the refresh.
  const refreshedAtom = Atom.make((get) => {
    get.refresh(positionsAtom);
    return Effect.ignore(
      get.resultOnce(positionsAtom, { suspendOnWaiting: true })
    );
  });

  return Atom.make((get) => {
    if (!marketsAtom || !AsyncResult.isSuccess(get(refreshedAtom))) {
      return null;
    }
    const positions = get(positionsAtom);
    const markets = get(marketsAtom);
    if (!AsyncResult.isSuccess(positions) || !AsyncResult.isSuccess(markets)) {
      return null;
    }

    return settleBorrowPosition({
      action: summary.action,
      marketId: command.args.marketId,
      markets: markets.value,
      positionMarketId: getBorrowFlowPositionMarketId(session),
      positions: positions.value,
    });
  }).pipe(Atom.withLabel("borrowFlowSettledPosition"));
};

/** One handed-off action's Execution in a Session. */
export class BorrowFlowExecutionKey extends Data.Class<{
  readonly actionId: ActionId;
  readonly session: BorrowFlowSession;
}> {}

/**
 * Steps' and Complete's view model for one handed-off action. Every render,
 * even one React discards, gets the same workflow Atom, so one workflow runs;
 * it runs while Steps or Complete shows it, and leaving both ends it.
 *
 * The model lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the model alive.
 */
export const borrowFlowExecutionPage = Atom.family(
  ({ actionId, session }: BorrowFlowExecutionKey) =>
    Atom.make(makeBorrowFlowExecutionPage(session, actionId)).pipe(
      Atom.withLabel("borrowFlowExecutionPage")
    )
);

export const makeBorrowFlowExecutionPage = (
  session: BorrowFlowSession,
  actionId: ActionId
) => {
  const positionPath = widgetRoutes.borrowPosition.build("Dashboard", {
    marketId: getBorrowFlowPositionMarketId(session),
  });
  const { dispatchAtom, stateAtom, workflowAtom } =
    makeTransactionFlowWorkflowAtoms(
      startBorrowFlowExecution(session, actionId),
      "borrowFlowExecution"
    );

  return {
    dispatchAtom,
    /** Back from Steps: returns where the flow began. */
    leaveAtom: walletRuntime
      .fn(() => leaveBorrowFlow("Steps"), { initialValue: undefined })
      .pipe(Atom.withLabel("leaveBorrowFlowExecution")),
    /**
     * Done on Complete: a position's flow ends on its page, which returns
     * to the positions list once the position is closed; a new one where it
     * began.
     */
    finishAtom: walletRuntime
      .fn(
        () =>
          session.intake.entry._tag === "MarketPosition"
            ? replaceBorrowFlowPage(positionPath)
            : restartBorrowFlow(session),
        { initialValue: undefined }
      )
      .pipe(Atom.withLabel("finishBorrowFlowExecution")),
    viewPositionAtom: walletRuntime
      .fn(() => replaceBorrowFlowPage(positionPath), {
        initialValue: undefined,
      })
      .pipe(Atom.withLabel("viewBorrowFlowPosition")),
    settledPositionAtom: makeBorrowFlowSettledPositionAtom(session),
    stateAtom,
    viewAtom: Atom.make((get) => {
      const state = Option.getOrNull(AsyncResult.value(get(stateAtom)));
      return state
        ? projectBorrowExecution(state, session.intake.summary.action)
        : emptyBorrowExecutionView;
    }).pipe(Atom.withLabel("borrowFlowExecutionView")),
    workflowAtom,
  } as const;
};
