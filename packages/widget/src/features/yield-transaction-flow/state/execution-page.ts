import { Data, Effect, Option, Ref, type Scope, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import {
  findYieldToken,
  getActionInputToken,
} from "../../../domain/action/rules";
import { getConfidentialActionBatchSide } from "../../../domain/earn/confidential";
import { exactZero } from "../../../domain/finance/exact";
import { getPositionValueTotal } from "../../../domain/portfolio/positions";
import { equalTokens } from "../../../domain/token/token";
import { pricesAtom } from "../../../resources/token-prices/index";
import {
  PositionDataKey,
  positionDataAtom,
} from "../../../resources/yield-positions/index";
import {
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../../services/navigation/widget-navigation";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";
import { afterCurrentRender } from "../../../shared/effect/after-render";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  getYieldFlowExit,
  getYieldFlowExitUnlockDate,
  getYieldFlowGasAmount,
  getYieldFlowPositionBalanceId,
  getYieldFlowWorkflowInput,
  getYieldFlowYieldId,
  getYieldTransactionFlowIntakeVariant,
  type YieldFlowHandoff,
  type YieldFlowSession,
} from "../model/yield-transaction-flow";
import { getYieldTransactionStepsView } from "../model/yield-transaction-workflow";
import { getYieldFlowReviewPricesKey } from "./review-prices";
import { makeYieldFlowEnterCompleteViewAtom } from "./yield-summary";

// A started router navigation cannot be cancelled, so a page that ends
// meanwhile waits for it instead of abandoning it mid-flight.
const navigate = (command: WidgetNavigationCommand) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(navigation.execute(command))
  );

/**
 * Starts `handoff`'s workflow, in the caller's Scope, if it is waiting in the
 * Session. It runs there until the Scope closes, so Review cannot hand off
 * another meanwhile; once it has started, a remount, history navigation, or
 * link to Steps finds nothing waiting and is interrupted.
 */
export const startYieldFlowExecution = Effect.fn("startYieldFlowExecution")(
  function* (
    session: YieldFlowSession,
    handoff: YieldFlowHandoff
  ): Effect.fn.Return<
    TransactionWorkflowHandle,
    TransactionWorkflowInputError,
    Scope.Scope | TransactionWorkflowService
  > {
    const started = yield* Effect.acquireRelease(
      Ref.modify(session.handoff, (current) =>
        current?._tag === "Waiting" && current.handoff === handoff
          ? [true, { _tag: "Running", handoff } as const]
          : ([false, current] as const)
      ),
      (taken) => (taken ? Ref.set(session.handoff, null) : Effect.void)
    );
    if (!started) return yield* Effect.interrupt;

    // Steps first reads this Atom while React renders.
    yield* afterCurrentRender;
    const transactionWorkflow = yield* TransactionWorkflowService;
    return yield* transactionWorkflow.make(
      getYieldFlowWorkflowInput({ session, source: handoff.source })
    );
  }
);

/**
 * How many history entries past the page it started from Execution sits:
 * Start pushed Review, Review pushed Steps, and Complete replaces Steps.
 */
const executionDepth = 2;

/**
 * Leaves Execution: back to Review, or out of the flow. Review pushed Steps,
 * so going back returns to its history entry rather than adding another
 * Review that Back would land on again. Leaving the flow goes back through
 * the history it pushed and puts its finish page in place of the page it
 * started from, so Back from there never returns to Review or Steps. Both
 * navigations run together, so an interrupted leave still lands there.
 */
export const leaveYieldFlowExecution = (
  { destination }: YieldFlowSession,
  to: "Exit" | "Review"
) =>
  to === "Review"
    ? navigate({ _tag: "Back" })
    : Effect.uninterruptible(
        navigate({ _tag: "Back", steps: executionDepth }).pipe(
          Effect.andThen(
            navigate({ _tag: "Replace", to: destination.finishPath })
          )
        )
      );

/** One handoff's Execution in a Session. */
export class YieldFlowExecutionKey extends Data.Class<{
  readonly handoff: YieldFlowHandoff;
  readonly session: YieldFlowSession;
}> {}

/**
 * Steps' and Complete's view model for one handoff. Every render,
 * even one React discards, gets the same workflow Atom, so one workflow runs;
 * it runs while Steps or Complete shows it, and leaving both ends it.
 *
 * The model lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the model alive.
 */
export const yieldFlowExecutionPage = Atom.family(
  ({ handoff, session }: YieldFlowExecutionKey) =>
    Atom.make(makeYieldFlowExecutionPage(session, handoff)).pipe(
      Atom.withLabel("yieldFlowExecutionPage")
    )
);

export const makeYieldFlowExecutionPage = (
  session: YieldFlowSession,
  handoff: YieldFlowHandoff
) => {
  const { intake } = session;
  const yieldId = getYieldFlowYieldId(session);
  const plannedStepTypes =
    handoff.source._tag === "Prepare" ? handoff.source.plannedStepTypes : [];

  // The workflow refreshes positions as it completes, so the balance shows
  // up here once the portfolio holds it.
  const positionAtom = Atom.make((get) =>
    AsyncResult.getOrElse(
      get(
        positionDataAtom(
          new PositionDataKey({ scope: intake.walletScope, yieldId })
        )
      ),
      () => null
    )
  ).pipe(Atom.withLabel("yieldFlowPosition"));
  const positionBalanceIdAtom = Atom.make((get) => {
    const position = get(positionAtom);
    return position
      ? getYieldFlowPositionBalanceId(session, [...position.balanceData.keys()])
      : null;
  }).pipe(Atom.withLabel("yieldFlowPositionBalanceId"));
  // One figure in one token, as Manage shows the position; none otherwise.
  const positionTotalAtom = Atom.make((get) => {
    const balanceId = get(positionBalanceIdAtom);
    const balances = balanceId
      ? get(positionAtom)?.balanceData.get(balanceId)?.balances
      : undefined;
    const sums = balances ? getPositionValueTotal(balances) : [];
    return sums.length === 1 ? (sums[0] ?? null) : null;
  }).pipe(Atom.withLabel("yieldFlowPositionTotal"));
  const exit = getYieldFlowExit(session);
  const exitUnlockDateAtom = Atom.make((get) => {
    const presentationTime = get(presentationClockAtom);
    if (!exit || !presentationTime) return null;
    const balanceId = get(positionBalanceIdAtom);
    const balances = balanceId
      ? (get(positionAtom)?.balanceData.get(balanceId)?.balances ?? [])
      : [];
    return getYieldFlowExitUnlockDate({
      balances,
      batched: exit.batched,
      now: presentationTime.now,
      yieldDto: exit.yieldDto,
    });
  }).pipe(Atom.withLabel("yieldFlowExitUnlockDate"));

  const executionAtom = walletRuntime
    .atom(startYieldFlowExecution(session, handoff))
    .pipe(Atom.withLabel("yieldFlowExecution"));
  const stateAtom = walletRuntime
    .atom((get) =>
      Stream.unwrap(
        get
          .result(executionAtom)
          .pipe(Effect.map((execution) => execution.states))
      )
    )
    .pipe(Atom.withLabel("yieldFlowExecutionState"));

  const workflowViewAtom = Atom.make((get) => {
    const state = Option.getOrNull(AsyncResult.value(get(stateAtom)));
    return {
      state,
      steps: state
        ? getYieldTransactionStepsView(state, {
            plannedStepTypes,
            yieldId,
          })
        : {
            error: null,
            numbered: true,
            resumable: false,
            retryable: false,
            sent: false,
            txStates: [],
            yieldId,
          },
    } as const;
  }).pipe(Atom.withLabel("yieldFlowExecutionView"));

  // What Review priced, again for Steps' details: the prices load from the
  // same request, so they are usually already there.
  const pricesKey = getYieldFlowReviewPricesKey(intake);
  const action =
    handoff.source._tag === "Action"
      ? handoff.source.action
      : handoff.source.prepared;
  const pricingViewAtom = Atom.make((get) => ({
    /** The action's USD value as the API priced it; null without one. */
    amountUsd: action?.amountUsd ?? null,
    /**
     * The estimated gas of every transaction; null when any is unknown, as
     * for the conversion a confidential deposit runs first.
     */
    gasAmount: getYieldFlowGasAmount(
      action,
      handoff.source._tag === "Action" ? exactZero() : null
    ),
    prices: AsyncResult.getOrElse(
      get(pricesAtom.foreground(pricesKey)),
      () => null
    ),
  })).pipe(Atom.withLabel("yieldFlowExecutionPricing"));
  const enterIntake = getYieldTransactionFlowIntakeVariant(intake, "Enter");

  return {
    activityCompleteViewAtom: Atom.make((get) => {
      const { state } = get(workflowViewAtom);
      if (state?.context.domain._tag !== "Yield") return null;
      const activity = getYieldTransactionFlowIntakeVariant(
        intake,
        "YieldActionContinuation"
      );
      if (!activity) return null;
      const { action } = activity;
      const inputToken =
        getActionInputToken({
          actionDto: action,
          yieldDto: activity.selectedYield,
        }) ?? null;
      const outputToken = action.rawArguments?.outputToken;
      const payoutToken =
        action.intent === "exit" && outputToken
          ? findYieldToken(activity.selectedYield, outputToken)
          : undefined;
      return {
        batchSide: getConfidentialActionBatchSide(
          activity.selectedYield,
          action
        ),
        inputToken,
        /** The token an exit pays out in, when it is not the exited one. */
        receiveToken:
          payoutToken && !(inputToken && equalTokens(payoutToken, inputToken))
            ? payoutToken
            : null,
        selectedAction: {
          amount: action.amount?.toFixed() ?? null,
          intent: action.intent,
          type: action.type,
          yieldId: action.yieldId,
        },
        selectedValidators: activity.selectedValidators,
        selectedYield: activity.selectedYield,
      } as const;
    }).pipe(Atom.withLabel("yieldFlowActivityCompleteView")),
    /** Complete's view of a deposit; null for other flows. */
    enterCompleteViewAtom: enterIntake
      ? makeYieldFlowEnterCompleteViewAtom(enterIntake, pricingViewAtom)
      : null,
    backAtom: walletRuntime
      .fn(() => leaveYieldFlowExecution(session, "Review"), {
        initialValue: undefined,
      })
      .pipe(Atom.withLabel("backYieldFlowExecution")),
    finishAtom: walletRuntime
      .fn(() => leaveYieldFlowExecution(session, "Exit"), {
        initialValue: undefined,
      })
      .pipe(Atom.withLabel("finishYieldFlowExecution")),
    /** When an exit's funds unlock; null for other flows or without one. */
    exitUnlockDateAtom,
    /** The position the finished flow leads to; null until it exists. */
    positionBalanceIdAtom,
    /** What the position the flow leads to holds; null until it is known. */
    positionTotalAtom,
    viewPositionAtom: walletRuntime
      .fn(
        (_input: undefined, get) => {
          const balanceId = get(positionBalanceIdAtom);
          return balanceId
            ? navigate({
                _tag: "Push",
                to: widgetRoutes.positionDetails.build({
                  balanceId,
                  integrationId: yieldId,
                }),
              })
            : Effect.void;
        },
        { initialValue: undefined }
      )
      .pipe(Atom.withLabel("viewYieldFlowPosition")),
    stateAtom,
    workflow: {
      dispatchAtom: walletRuntime
        .fn(
          (command: TransactionWorkflowCommand, get) =>
            get
              .result(executionAtom)
              .pipe(Effect.flatMap((execution) => execution.dispatch(command))),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("dispatchYieldFlowWorkflow")),
      viewAtom: workflowViewAtom,
    },
    /** The amount's value, the gas and the prices Steps' details show. */
    pricingViewAtom,
    executionAtom,
  } as const;
};
