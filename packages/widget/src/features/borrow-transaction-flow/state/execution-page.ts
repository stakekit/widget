import { Data, Effect, Option, Ref, type Scope, Stream } from "effect";
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
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowCommand,
  type TransactionWorkflowInputError,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";
import { afterCurrentRender } from "../../../shared/effect/after-render";
import { settleBorrowPosition } from "../model/borrow-completion";
import type { BorrowFlowSession } from "../model/borrow-transaction-flow";
import {
  emptyBorrowExecutionView,
  projectBorrowExecution,
} from "../model/borrow-transaction-workflow";
import { leaveBorrowFlow, restartBorrowFlow } from "./borrow-flow-session";

/**
 * Starts the workflow for `actionId`, in the caller's Scope, if that action is
 * waiting in the Session. It runs there until the Scope closes, so Review
 * cannot hand off another meanwhile; once it has started, a remount, history
 * navigation, or link to Steps finds nothing waiting and is interrupted.
 */
export const startBorrowFlowExecution = Effect.fn("startBorrowFlowExecution")(
  function* (
    { handoff, walletScope }: BorrowFlowSession,
    actionId: ActionId
  ): Effect.fn.Return<
    TransactionWorkflowHandle,
    TransactionWorkflowInputError,
    Scope.Scope | TransactionWorkflowService
  > {
    const action = yield* Effect.acquireRelease(
      Ref.modify(handoff, (current) =>
        current?._tag === "Waiting" && current.action.id === actionId
          ? [
              current.action,
              { _tag: "Running", action: current.action } as const,
            ]
          : ([null, current] as const)
      ),
      (started) => (started ? Ref.set(handoff, null) : Effect.void)
    );
    if (!action) return yield* Effect.interrupt;

    // Steps first reads this Atom while React renders.
    yield* afterCurrentRender;
    const workflows = yield* TransactionWorkflowService;
    return yield* workflows.make(
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
  const workflowAtom = walletRuntime
    .atom(startBorrowFlowExecution(session, actionId))
    .pipe(Atom.withLabel("borrowFlowExecutionWorkflow"));
  const stateAtom = walletRuntime
    .atom((get) =>
      Stream.unwrap(
        get.result(workflowAtom).pipe(Effect.map((workflow) => workflow.states))
      )
    )
    .pipe(Atom.withLabel("borrowFlowExecutionState"));

  return {
    dispatchAtom: walletRuntime
      .fn(
        (command: TransactionWorkflowCommand, get) =>
          get
            .result(workflowAtom)
            .pipe(Effect.flatMap((workflow) => workflow.dispatch(command))),
        { concurrent: false, initialValue: undefined }
      )
      .pipe(Atom.withLabel("dispatchBorrowFlowWorkflow")),
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
      return state ? projectBorrowExecution(state) : emptyBorrowExecutionView;
    }).pipe(Atom.withLabel("borrowFlowExecutionView")),
    workflowAtom,
  } as const;
};
