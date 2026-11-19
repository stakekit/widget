import { Data, DateTime, Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  findYieldToken,
  getActionInputToken,
} from "../../../domain/action/rules";
import { getConfidentialActionBatchSide } from "../../../domain/earn/confidential";
import { exactZero } from "../../../domain/finance/exact";
import { getPositionValueTotal } from "../../../domain/portfolio/positions";
import { equalTokens } from "../../../domain/token/token";
import { optionalTokenPricesAtom } from "../../../resources/token-prices/token-prices";
import {
  PositionDataKey,
  positionDataAtom,
} from "../../../resources/yield-positions/yield-positions";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import {
  makeTransactionFlowWorkflowAtoms,
  navigateTransactionFlow,
  startTransactionFlowExecution,
} from "../../transaction-flow/index";
import {
  getYieldFlowExit,
  getYieldFlowExitUnlockDate,
  getYieldFlowPositionBalanceId,
} from "../model/completion";
import type { YieldActionContinuationIntake } from "../model/intake";
import { getYieldFlowGasAmount } from "../model/pricing";
import {
  getYieldFlowPlannedSteps,
  getYieldFlowYieldId,
  type YieldFlowHandoff,
  type YieldFlowSession,
} from "../model/session";
import { getYieldFlowWorkflowInput } from "../model/workflow-input";
import {
  getYieldTransactionStepsView,
  isYieldTransactionWorkflowFinished,
} from "../model/yield-transaction-workflow";
import { getYieldFlowReviewPricesKey } from "./review-prices";
import { makeYieldFlowEnterCompleteViewAtom } from "./yield-summary";

/**
 * Starts `handoff`'s workflow, in the caller's Scope, if it is waiting in the
 * Session; see `startTransactionFlowExecution`.
 */
export const startYieldFlowExecution = Effect.fn("startYieldFlowExecution")(
  function* (session: YieldFlowSession, handoff: YieldFlowHandoff) {
    return yield* startTransactionFlowExecution(
      session.handoff,
      (waiting) => waiting.handoff === handoff,
      () => getYieldFlowWorkflowInput({ session, source: handoff.source })
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
    ? navigateTransactionFlow({ _tag: "Back" })
    : Effect.uninterruptible(
        navigateTransactionFlow({ _tag: "Back", steps: executionDepth }).pipe(
          Effect.andThen(
            navigateTransactionFlow({
              _tag: "Replace",
              to: destination.finishPath,
            })
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

/** What Complete adds for an action continued from Activity. */
const makeYieldFlowActivityCompleteViewAtom = (
  activity: YieldActionContinuationIntake
) => {
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
  return Atom.make({
    batchSide: getConfidentialActionBatchSide(activity.selectedYield, action),
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
  } as const).pipe(Atom.withLabel("yieldFlowActivityCompleteView"));
};

/**
 * The page model for `session`'s intake: what every flow shows, and, only on
 * its own variant, what Complete adds for a deposit, an exit, or an action
 * continued from Activity.
 */
const makeYieldFlowExecutionPage = (
  session: YieldFlowSession,
  handoff: YieldFlowHandoff
) => {
  const { intake } = session;
  const yieldId = getYieldFlowYieldId(session);
  const plannedStepTypes = getYieldFlowPlannedSteps(handoff.source);

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

  const {
    completionAtom,
    dispatchAtom,
    executionStatusAtom,
    stateAtom,
    workflowAtom,
  } = makeTransactionFlowWorkflowAtoms(
    startYieldFlowExecution(session, handoff),
    {
      // Confidential steps run before the workflow has a state.
      isFinished: isYieldTransactionWorkflowFinished,
      label: "yieldFlowExecution",
    }
  );

  // When the workflow completed, read once from Effect's clock: the fallback
  // unlock date counts the cooldown from it, so it holds still on Complete.
  const completedAtAtom = walletRuntime
    .atom((get) =>
      Stream.unwrap(
        get.result(workflowAtom).pipe(
          Effect.map((execution) =>
            execution.states.pipe(
              Stream.filter((state) => state._tag === "Completed"),
              Stream.take(1),
              Stream.mapEffect(() => DateTime.now)
            )
          )
        )
      )
    )
    .pipe(Atom.withLabel("yieldFlowCompletedAt"));
  const exit = getYieldFlowExit(session);
  /** When an exit's funds unlock; null without one. */
  const exitUnlockDateAtom = Atom.make((get) => {
    const completedAt = Option.getOrNull(
      AsyncResult.value(get(completedAtAtom))
    );
    if (!exit || !completedAt) return null;
    const balanceId = get(positionBalanceIdAtom);
    const balances = balanceId
      ? (get(positionAtom)?.balanceData.get(balanceId)?.balances ?? [])
      : [];
    return getYieldFlowExitUnlockDate({
      balances,
      batched: exit.batched,
      completedAt,
      yieldDto: exit.yieldDto,
    });
  }).pipe(Atom.withLabel("yieldFlowExitUnlockDate"));

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
      get(optionalTokenPricesAtom.foreground(pricesKey)),
      () => null
    ),
  })).pipe(Atom.withLabel("yieldFlowExecutionPricing"));

  const page = {
    /** Whether the workflow finished; false until it has a state. */
    completionAtom,
    executionStatusAtom,
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
    /** The position the finished flow leads to; null until it exists. */
    positionBalanceIdAtom,
    /** What the position the flow leads to holds; null until it is known. */
    positionTotalAtom,
    viewPositionAtom: walletRuntime
      .fn(
        (_input: undefined, get) => {
          const balanceId = get(positionBalanceIdAtom);
          return balanceId
            ? navigateTransactionFlow({
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
    workflow: {
      dispatchAtom,
      viewAtom: workflowViewAtom,
    },
    /** The amount's value, the gas and the prices Steps' details show. */
    pricingViewAtom,
  } as const;

  switch (intake._tag) {
    case "Enter":
      return {
        ...page,
        _tag: intake._tag,
        intake,
        /** Complete's view of the deposit. */
        enterCompleteViewAtom: makeYieldFlowEnterCompleteViewAtom(
          intake,
          pricingViewAtom
        ),
      } as const;
    case "Exit":
      return {
        ...page,
        _tag: intake._tag,
        intake,
        exitUnlockDateAtom,
      } as const;
    case "Manage":
      return { ...page, _tag: intake._tag, intake } as const;
    case "YieldActionContinuation":
      return {
        ...page,
        _tag: intake._tag,
        intake,
        activityCompleteViewAtom: makeYieldFlowActivityCompleteViewAtom(intake),
        /** A continued exit's unlock date; null for other intents. */
        exitUnlockDateAtom,
      } as const;
  }
};

export type YieldFlowExecutionPage = ReturnType<
  typeof makeYieldFlowExecutionPage
>;

/** Steps' and Complete's model for one intake variant. */
export type YieldFlowExecutionVariant<
  Tag extends YieldFlowExecutionPage["_tag"],
> = Extract<YieldFlowExecutionPage, { readonly _tag: Tag }>;
