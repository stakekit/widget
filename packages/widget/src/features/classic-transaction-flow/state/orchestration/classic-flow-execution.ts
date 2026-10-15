import {
  Data,
  Deferred,
  Duration,
  Effect,
  Option,
  PubSub,
  Ref,
  Schedule,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import type { YieldAction } from "../../../../domain/action/models";
import {
  confidentialTokenBalanceKey,
  getConfidentialAssetToken,
} from "../../../../domain/earn/confidential";
import {
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationCommand,
  type WidgetNavigationError,
  type WidgetPath,
} from "../../../../services/navigation/widget-navigation";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
  TransactionWorkflowState,
} from "../../../../services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../../services/transaction-workflow/transaction-workflow-service";
import { ConfidentialValues } from "../../../../services/zama/confidential-values";
import { ZamaService } from "../../../../services/zama/zama-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type ClassicTransactionFlowIntake,
  getClassicFlowConfidentialInput,
  getClassicTransactionWorkflowInput,
} from "../../model/classic-transaction-flow";
import {
  type ClassicFlowConversion,
  type ClassicFlowConversionStepStatus,
  isClassicTransactionWorkflowFinished,
} from "../../model/classic-transaction-workflow";

type ClassicFlowFinishOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedNotCompleted" }>;

export class ClassicFlowPrepareError extends Data.TaggedError(
  "ClassicFlowPrepareError"
)<{
  readonly cause: unknown;
  /** False when the API rejected the request itself. */
  readonly retryable: boolean;
}> {}

export type ClassicFlowExecutionSource =
  | Readonly<{ readonly _tag: "Action"; readonly action: YieldAction }>
  // Confidential actions exist only once the amount is encrypted.
  | Readonly<{
      readonly _tag: "Prepare";
      readonly prepare: Effect.Effect<YieldAction, ClassicFlowPrepareError>;
      readonly step: "decrypt" | "encrypt";
    }>;

/**
 * Execution of one reserved Classic action. Its operations run only while the
 * Scope it was acquired in is open; the Session closes that Scope when the
 * reservation or the Session ends.
 */
export type ClassicFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<void, WidgetNavigationError>;
  readonly conversion: Stream.Stream<ClassicFlowConversion | null>;
  readonly finish: () => Effect.Effect<
    ClassicFlowFinishOutcome,
    WidgetNavigationError
  >;
  readonly runWorkflow: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly states: Stream.Stream<
    TransactionWorkflowState,
    TransactionWorkflowInputError
  >;
}>;

export const makeClassicFlowExecutionFactory = Effect.fn(
  "makeClassicFlowExecutionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const transactionWorkflow = yield* TransactionWorkflowService;
  const zama = yield* ZamaService;
  const confidentialValues = yield* ConfidentialValues;
  // A started router navigation cannot be cancelled, so an ending Execution
  // waits for it instead of abandoning it mid-flight.
  const navigate = (command: WidgetNavigationCommand) =>
    Effect.uninterruptible(navigation.execute(command));

  return Effect.fn("makeClassicFlowExecution")(function* ({
    convertedRef,
    intake,
    paths,
    source,
  }: {
    // Set once the wrap confirms, so a later execution does not wrap again.
    readonly convertedRef: Ref.Ref<boolean>;
    readonly intake: ClassicTransactionFlowIntake;
    readonly paths: Readonly<{
      readonly completePath: WidgetPath;
      readonly reviewPath: WidgetPath;
    }>;
    readonly source: ClassicFlowExecutionSource;
  }): Effect.fn.Return<
    ClassicFlowExecutionHandle,
    TransactionWorkflowInputError,
    Scope.Scope
  > {
    const confidential = getClassicFlowConfidentialInput(intake);
    const conversion =
      intake._tag === "Enter" &&
      confidential?.conversion &&
      !(yield* Ref.get(convertedRef))
        ? {
            amount: confidential.amount,
            network: intake.selectedStake.network,
            owner: intake.request.address,
            target: confidential.conversion,
          }
        : null;
    const asset = confidential
      ? getConfidentialAssetToken(confidential.yieldDto)
      : null;
    // A revealed balance is stale once the flow moves funds.
    const forgetTokenBalance =
      asset && (intake._tag === "Enter" || intake._tag === "Exit")
        ? confidentialValues.remove(
            (key) =>
              key ===
              confidentialTokenBalanceKey({
                owner: intake.request.address,
                token: asset,
              })
          )
        : Effect.void;
    const operations = yield* makeScopedSerialOperations();

    const workflowDeferred = yield* Deferred.make<
      TransactionWorkflowHandle,
      TransactionWorkflowInputError
    >();
    const actionRef = yield* Ref.make<YieldAction | null>(
      source._tag === "Action" ? source.action : null
    );
    const conversionRef =
      yield* SubscriptionRef.make<ClassicFlowConversion | null>(null);
    yield* Effect.addFinalizer(() => PubSub.shutdown(conversionRef.pubsub));
    const scope = yield* Effect.scope;
    const startWorkflow = (action: YieldAction) =>
      transactionWorkflow
        .make(getClassicTransactionWorkflowInput(intake, action))
        .pipe(
          Effect.flatMap((workflow) =>
            Deferred.succeed(workflowDeferred, workflow)
          ),
          Scope.provide(scope)
        );

    const setStepStatus = (
      index: number,
      status: ClassicFlowConversionStepStatus
    ) =>
      SubscriptionRef.update(conversionRef, (current) =>
        current
          ? {
              ...current,
              steps: current.steps.map((step, stepIndex) =>
                stepIndex === index ? { ...step, status } : step
              ),
            }
          : current
      );

    const planSteps = Effect.gen(function* () {
      const conversionSteps = conversion
        ? yield* zama
            .conversionSteps({
              amount: conversion.amount,
              conversion: conversion.target,
              owner: conversion.owner,
            })
            // An unknown allowance only costs a redundant approve.
            .pipe(Effect.orElseSucceed(() => ["approve", "wrap"] as const))
        : [];
      return [
        ...(source._tag === "Prepare" ? [source.step] : []),
        ...conversionSteps,
      ].map((step) => ({ status: "idle" as const, step }));
    });

    const runSteps = Effect.gen(function* () {
      const steps =
        (yield* SubscriptionRef.get(conversionRef))?.steps ??
        (yield* planSteps);
      yield* SubscriptionRef.set(conversionRef, {
        steps,
        transactions: (yield* Ref.get(actionRef))?.transactions ?? [],
      });

      for (const [index, { status, step }] of steps.entries()) {
        if (status === "done") continue;
        yield* setStepStatus(index, "signing");
        const markFailed = <A, E>(effect: Effect.Effect<A, E>) =>
          effect.pipe(
            Effect.tapCause((cause) =>
              Effect.logError("Confidential flow step failed").pipe(
                Effect.annotateLogs({ cause, step })
              )
            ),
            Effect.tapError((error) =>
              setStepStatus(
                index,
                error instanceof ClassicFlowPrepareError && !error.retryable
                  ? "rejected"
                  : "failed"
              )
            )
          );
        if (step === "encrypt" || step === "decrypt") {
          if (source._tag === "Prepare") {
            const action = yield* source.prepare.pipe(markFailed);
            yield* Ref.set(actionRef, action);
            yield* SubscriptionRef.update(conversionRef, (current) =>
              current
                ? { ...current, transactions: action.transactions }
                : current
            );
          }
        } else {
          const action = yield* Ref.get(actionRef);
          if (!conversion || !action) {
            return yield* setStepStatus(index, "rejected");
          }
          yield* zama
            .convertStep({
              actionMeta: getClassicTransactionWorkflowInput(intake, action)
                .actionMeta,
              amount: conversion.amount,
              conversion: conversion.target,
              network: conversion.network,
              onBroadcast: setStepStatus(index, "confirming"),
              owner: conversion.owner,
              step,
              walletScope: intake.walletScope,
            })
            .pipe(markFailed);
          if (step === "wrap") {
            yield* Ref.set(convertedRef, true);
            yield* forgetTokenBalance;
          }
        }
        yield* setStepStatus(index, "done");
      }
      const action = yield* Ref.get(actionRef);
      if (action) {
        yield* startWorkflow(action).pipe(
          Effect.tapError((error) => Deferred.fail(workflowDeferred, error))
        );
      }
    }).pipe(Effect.ignore);

    if (source._tag === "Action" && !conversion) {
      yield* startWorkflow(source.action);
    } else {
      yield* runSteps.pipe(Effect.forkScoped({ startImmediately: true }));
    }
    const states = Stream.unwrap(
      Deferred.await(workflowDeferred).pipe(
        Effect.map((workflow) => workflow.states)
      )
    );

    yield* states.pipe(
      Stream.filter(isClassicTransactionWorkflowFinished),
      Stream.take(1),
      Stream.runForEach(() =>
        forgetTokenBalance.pipe(
          Effect.andThen(
            operations
              .run(navigate({ _tag: "Replace", path: paths.completePath }))
              .pipe(
                Effect.retry({
                  schedule: Schedule.spaced(Duration.millis(100)),
                })
              )
          )
        )
      ),
      Effect.ignore,
      Effect.forkScoped({ startImmediately: true })
    );

    const finishOpen = Effect.fn("ClassicFlowExecution.finish")(
      function* (): Effect.fn.Return<
        ClassicFlowFinishOutcome,
        WidgetNavigationError
      > {
        const workflow = (yield* Deferred.isDone(workflowDeferred))
          ? yield* Effect.option(Deferred.await(workflowDeferred))
          : Option.none();
        const state = Option.isSome(workflow)
          ? yield* workflow.value.states.pipe(Stream.runHead)
          : Option.none();
        if (
          Option.isNone(state) ||
          !isClassicTransactionWorkflowFinished(state.value)
        ) {
          return { _tag: "RejectedNotCompleted" } as const;
        }
        yield* navigate({
          _tag: "Push",
          path: toWidgetPath(
            intake._tag === "YieldActionContinuation" ? "/activity" : "/"
          ),
        });
        return { _tag: "Accepted" } as const;
      }
    );

    const runWorkflowOpen = Effect.fn("ClassicFlowExecution.runWorkflow")(
      function* (command: TransactionWorkflowCommand) {
        if (yield* Deferred.isDone(workflowDeferred)) {
          // A failed start already surfaces through `states`.
          const workflow = yield* Effect.option(
            Deferred.await(workflowDeferred)
          );
          if (Option.isSome(workflow)) {
            yield* workflow.value.dispatch(command);
          }
          return;
        }
        // Never alongside a running conversion.
        const current = yield* SubscriptionRef.get(conversionRef);
        if (current?.steps.some((step) => step.status === "failed")) {
          yield* runSteps.pipe(Effect.forkIn(scope));
        }
      }
    );

    return {
      back: () =>
        operations.run(navigate({ _tag: "Replace", path: paths.reviewPath })),
      conversion: SubscriptionRef.changes(conversionRef),
      finish: () => operations.run(finishOpen()),
      runWorkflow: (command) => operations.run(runWorkflowOpen(command)),
      states,
    };
  });
});
