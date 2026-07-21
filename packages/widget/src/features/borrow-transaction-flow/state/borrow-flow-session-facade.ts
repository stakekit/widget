import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { Action } from "../../../domain/borrow/action";
import type { Transaction } from "../../../domain/borrow/transaction";
import { BorrowApiService } from "../../../services/api/borrow-api-service";
import {
  BorrowTransactionWorkflowInput,
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  initializeTransactionWorkflow,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
} from "../../../services/workflow/transaction-workflow-model";
import {
  makeTransactionWorkflowModule,
  type TransactionWorkflowLoadingError,
} from "../../transaction-workflow/state";
import {
  type BorrowFlowSession,
  borrowFlowSessionStore,
} from "./borrow-flow-session-store";
import { publishBorrowTransactionFlowOutcomeAtom } from "./outcomes";

class BorrowActionCreationError extends Data.TaggedError(
  "BorrowActionCreationError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

const terminalStatuses = new Set(["FAILED", "CANCELED", "STALE"]);

const validateCreatedAction = (action: Action) =>
  terminalStatuses.has(action.status)
    ? Effect.fail(
        new BorrowActionCreationError({
          message: `Borrow action ended with ${action.status} status.`,
        })
      )
    : Effect.succeed(action);

type BorrowFlowSessionState = Readonly<{
  readonly executionAction: Action | null;
  readonly navigation: "Base" | "Steps" | null;
}>;

type BorrowExecutionPhase =
  | "advancing"
  | "completed"
  | "confirming"
  | "disabled"
  | "signing"
  | "submitting";

const getExecutionError = (
  state: TransactionWorkflowState
): TransactionWorkflowError | null => {
  switch (state._tag) {
    case "SignFailed":
    case "SubmissionFailed":
    case "ConfirmationFailed":
    case "AdvanceFailed":
      return state.error;
    default:
      return null;
  }
};

const getExecutionPhase = (
  state: TransactionWorkflowState
): BorrowExecutionPhase => {
  switch (state._tag) {
    case "SignFailed":
    case "Signing":
      return "signing";
    case "SubmissionFailed":
    case "Submitting":
      return "submitting";
    case "ConfirmationFailed":
    case "Confirming":
      return "confirming";
    case "AdvanceFailed":
    case "Advancing":
      return "advancing";
    case "Completed":
      return "completed";
    case "Disabled":
      return "disabled";
  }
};

export const makeBorrowFlowSessionModule = (session: BorrowFlowSession) => {
  const stateAtom = Atom.make<BorrowFlowSessionState>({
    executionAction: null,
    navigation: null,
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("borrowFlowSessionState"));
  const isCurrentSessionAtom = Atom.make(
    (get) =>
      get(borrowFlowSessionStore.currentSessionAtom)?.epoch === session.epoch
  ).pipe(Atom.withLabel("isCurrentBorrowFlowSession"));
  const navigationAtom = Atom.make((get) =>
    get(isCurrentSessionAtom) ? get(stateAtom).navigation : null
  ).pipe(Atom.withLabel("borrowFlowSessionNavigation"));
  const executionActionAtom = Atom.make(
    (get) => get(stateAtom).executionAction
  ).pipe(Atom.withLabel("borrowFlowExecutionAction"));

  const createActionAtom = appRuntime.fn(
    (_input: undefined) =>
      BorrowApiService.use((api) =>
        api.executeAction(session.intake.request)
      ).pipe(
        Effect.mapError(
          (cause) =>
            new BorrowActionCreationError({
              cause,
              message: "Borrow action could not be created.",
            })
        ),
        Effect.flatMap(validateCreatedAction)
      ),
    { concurrent: false }
  );
  const createActionResultAtom = Atom.make((get) => get(createActionAtom)).pipe(
    Atom.withLabel("borrowFlowCreateActionResult")
  );
  const confirmAtom = Atom.fnSync(
    (_input: undefined, context) => {
      if (
        !context(isCurrentSessionAtom) ||
        context(stateAtom).executionAction ||
        context(createActionAtom).waiting
      ) {
        return;
      }
      context.set(createActionAtom, undefined);
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("confirmBorrowFlowReview"));
  const backAtom = Atom.fnSync(
    (_input: undefined, context) => {
      if (!context(isCurrentSessionAtom)) return;
      context.set(stateAtom, { ...context(stateAtom), navigation: "Base" });
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("backBorrowFlow"));
  const doneAtom = Atom.fnSync(
    (_input: undefined, context) => {
      if (!context(isCurrentSessionAtom)) return;
      context.set(publishBorrowTransactionFlowOutcomeAtom, {
        _tag: "Done",
        epoch: session.epoch,
      });
      context.set(stateAtom, { ...context(stateAtom), navigation: "Base" });
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("finishBorrowFlow"));
  const reviewRootAtom = Atom.make((context) => {
    const state = context.once(stateAtom);
    if (!state.executionAction) return;
    context.set(stateAtom, { executionAction: null, navigation: null });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("borrowFlowReviewRoot"));

  const makeExecutionScopeAtom = () =>
    Atom.make((context) => {
      const action = context.once(executionActionAtom);
      if (!action) return null;

      const workflowInput = new BorrowTransactionWorkflowInput({
        action,
        walletScope: session.walletScope,
      });
      const workflow = makeTransactionWorkflowModule(workflowInput);
      context.mount(workflow.rootAtom);
      const viewAtom = Atom.make((get) => {
        const result = get(workflow.stateAtom);
        const state = Option.getOrElse(AsyncResult.value(result), () =>
          initializeTransactionWorkflow(workflowInput)
        );
        const currentBatch = getCurrentTransactionWorkflowBatch(state.context);
        const current = getCurrentTransactionWorkflowTransaction(state.context);
        const latestAction =
          state.context.domain._tag === "Borrow"
            ? state.context.domain.action
            : workflowInput.action;
        const currentTransaction: Transaction | null =
          current?.source._tag === "Borrow" ? current.source.transaction : null;
        const completed = state._tag === "Completed";

        return {
          action: latestAction,
          batches: state.context.batches,
          completionResult: completed
            ? { action: latestAction, submissions: state.context.submissions }
            : null,
          currentBatchTransactionCount: currentBatch?.transactions.length ?? 0,
          currentStep: currentBatch?.currentStep ?? latestAction.currentStep,
          currentTransaction,
          currentTransactionIndex: state.context.currentTransactionIndex,
          error: getExecutionError(state),
          isDone: completed,
          isRunning:
            state._tag === "Signing" ||
            state._tag === "Submitting" ||
            state._tag === "Confirming" ||
            state._tag === "Advancing",
          phase: getExecutionPhase(state),
          result,
          setupError: Option.getOrNull(
            AsyncResult.error(result)
          ) as TransactionWorkflowLoadingError | null,
          state,
          submissions: state.context.submissions,
          totalSteps: currentBatch?.totalSteps ?? latestAction.totalSteps,
        } as const;
      }).pipe(Atom.withLabel("borrowFlowExecutionView"));
      const completionNavigationAtom = Atom.make((get) =>
        get(isCurrentSessionAtom) && get(viewAtom).isDone ? "Complete" : null
      ).pipe(Atom.withLabel("borrowFlowExecutionCompletionNavigation"));
      const routeRootAtom = Atom.make((rootContext) => {
        rootContext.set(stateAtom, {
          executionAction: action,
          navigation: null,
        });
      }).pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel("borrowFlowExecutionRouteRoot")
      );

      return {
        completionNavigationAtom,
        retryAtom: workflow.commandAtom,
        routeRootAtom,
        viewAtom,
        workflowInput,
      } as const;
    }).pipe(Atom.setIdleTTL(0), Atom.withLabel("borrowFlowExecutionScope"));

  const module = {
    facade: {
      backAtom,
      confirmAtom,
      createActionResultAtom,
      doneAtom,
      intake: session.intake,
      navigationAtom,
      reviewRootAtom,
    },
    ports: { makeExecutionScopeAtom },
  } as const;

  const rootAtom = Atom.make((context) => {
    const registry = context.registry;
    context.mount(stateAtom);
    context.subscribe(createActionAtom, (result) => {
      const action = Option.getOrNull(AsyncResult.value(result));
      if (
        !action ||
        registry.get(stateAtom).executionAction ||
        !registry.get(isCurrentSessionAtom)
      ) {
        return;
      }

      registry.set(stateAtom, {
        executionAction: action,
        navigation: "Steps",
      });
      registry.set(publishBorrowTransactionFlowOutcomeAtom, {
        _tag: "ExecutionStarted",
        epoch: session.epoch,
      });
    });
    context.addFinalizer(() => {
      registry.set(borrowFlowSessionStore.clearAtom, session.epoch);
    });
    return module;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("borrowFlowSessionRoot"));

  return rootAtom;
};

export type BorrowFlowSessionModule = Atom.Type<
  ReturnType<typeof makeBorrowFlowSessionModule>
>;
export type BorrowFlowSessionFacade = BorrowFlowSessionModule["facade"];

export const makeBorrowFlowExecutionScope = (
  session: BorrowFlowSessionModule
) => session.ports.makeExecutionScopeAtom();

export type BorrowFlowExecutionModule = NonNullable<
  Atom.Type<ReturnType<typeof makeBorrowFlowExecutionScope>>
>;
