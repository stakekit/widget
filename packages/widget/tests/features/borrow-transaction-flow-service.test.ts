import { describe, expect, it, vi } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  type BorrowTransactionFlowIntake,
  decodeBorrowFlowNavigationState,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { BorrowActionCreationError } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-flow-review";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { BorrowOperations } from "../../src/services/api/operations";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import {
  toWidgetPath,
  type WidgetNavigation,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../src/services/navigation/widget-navigation";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
} from "../fixtures/wallet-state";
import { makeTestTracking } from "../utils/services/tracking-service";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTestNavigation } from "../utils/services/widget-navigation";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);

const connectedWalletState = (scope: WalletScopeKey): WalletState =>
  makeConnectedWalletState(scope);

const connectingWalletState = (scope: WalletScopeKey): WalletState =>
  makeConnectingWalletState(scope);
const walletScope = new WalletScopeKey({ address, network: "base" });

const intake: BorrowTransactionFlowIntake = {
  command: {
    action: "borrow",
    address,
    args: { marketId: Schema.decodeSync(MarketId)("market-1") },
    integrationId: Schema.decodeSync(IntegrationId)("provider-1"),
  },
  entry: { _tag: "BorrowEntry" },
  summary: {
    action: "borrow",
    borrowAmount: "1",
    debtPrincipalAmount: "1",
    loanTokenPriceUsd: "1",
    originationFeeAmount: "0",
    existingCollateralUsd: "100",
    existingDebtUsd: "0",
    loanTokenSymbol: "USDC",
    marketLabel: "USDC market",
    network: "base",
    projectedCollateralUsd: "100",
    projectedDebtUsd: "1",
    providerName: "Provider",
    riskStatus: "unavailable",
    warnings: [],
  },
};

const transaction = (id = "tx-1"): Transaction =>
  Schema.decodeSync(Transaction)({
    address,
    chainId: "8453",
    id,
    network: "base",
    signablePayload: "0x00",
    signingFormat: "EVM_TRANSACTION",
    status: "WAITING_FOR_SIGNATURE",
    type: "BORROW",
  });

const action = (status = "CREATED") =>
  Schema.decodeUnknownSync(Action)({
    action: "borrow",
    address,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id: "action-1",
    integrationId: "provider-1",
    rawArguments: intake.command.args,
    status,
    totalSteps: 1,
    transactions: [Schema.encodeSync(Transaction)(transaction())],
  });

type ServiceOverrides = Readonly<{
  readonly borrowEnabled?: boolean;
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly executeAction?: BorrowOperations["Service"]["executeAction"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
}>;

const makeBorrowFlowTestLayer = Effect.fn("makeBorrowFlowTestLayer")(function* (
  initialWalletState: WalletState,
  overrides: ServiceOverrides = {}
) {
  const navigation = yield* makeTestNavigation(
    overrides.execute ? { execute: overrides.execute } : {}
  );
  const tracking = yield* makeTestTracking();
  const wallet = yield* makeTestWallet({ initialState: initialWalletState });
  const dependencies = Layer.mergeAll(
    WidgetConfigService.layer({
      apiKey: "test-api-key",
      borrowEnabled: overrides.borrowEnabled ?? true,
      dashboardVariant: true,
      variant: "default",
    }),
    navigation.layer,
    wallet.layer,
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction:
          overrides.executeAction ?? (() => Effect.succeed(action())),
      } as never)
    ),
    tracking.layer,
    Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make:
          overrides.makeWorkflow ??
          ((input) =>
            Effect.succeed({
              dispatch: () => Effect.void,
              states: Stream.succeed(initializeTransactionWorkflow(input)),
            })),
      })
    )
  );
  return {
    layer: BorrowTransactionFlowService.layer.pipe(Layer.provide(dependencies)),
    setWalletState: wallet.setState,
  } as const;
});

// The flow route opens the Session it was navigated to, in its own Scope.
const acquireStartedSession = Effect.fn("test.acquireStartedBorrowSession")(
  function* (service: BorrowTransactionFlowService["Service"]) {
    const started = yield* service.start(intake);
    if (started._tag !== "Started") {
      return yield* Effect.die("Expected a started Borrow Flow Session");
    }
    const session = yield* service.openSession(started.session);
    return { captured: started.session, session } as const;
  }
);

describe("BorrowTransactionFlowService", () => {
  it.effect(
    "navigates to Review carrying a fresh Flow Session with a copied intake",
    () =>
      Effect.gen(function* () {
        const commands: Array<WidgetNavigationCommand> = [];
        const flow = yield* makeBorrowFlowTestLayer(
          connectingWalletState(walletScope),
          {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const first = yield* service.start(intake);
            const second = yield* service.start(intake);
            return { first, second };
          })
        ).pipe(Effect.provide(flow.layer));

        if (
          result.first._tag !== "Started" ||
          result.second._tag !== "Started"
        ) {
          throw new Error("Expected started Borrow Flow Sessions");
        }
        expect(result.first.session).not.toBe(result.second.session);
        expect(result.second.session.intake).toEqual(intake);
        expect(result.second.session.intake).not.toBe(intake);
        expect(
          commands.map((command) => ({
            path: command._tag === "Back" ? null : command.path,
            session: Option.getOrNull(
              decodeBorrowFlowNavigationState(command.state)
            ),
          }))
        ).toEqual([
          {
            path: toWidgetPath("/borrow/review"),
            session: result.first.session,
          },
          {
            path: toWidgetPath("/borrow/review"),
            session: result.second.session,
          },
        ]);
      })
  );

  it.effect(
    "finishes Review navigation before an interrupted Start completes",
    () =>
      Effect.gen(function* () {
        const navigationStarted = yield* Deferred.make<void>();
        const navigationRelease = yield* Deferred.make<void>();
        const navigated: Array<string> = [];
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: () =>
              Deferred.succeed(navigationStarted, undefined).pipe(
                Effect.andThen(Deferred.await(navigationRelease)),
                Effect.andThen(
                  Effect.sync(() => {
                    navigated.push("review");
                  })
                )
              ),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const start = yield* service
              .start(intake)
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(navigationStarted);
            const interrupt = yield* Fiber.interrupt(start).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            const interruptedBeforeNavigation = interrupt.pollUnsafe();
            yield* Deferred.succeed(navigationRelease, undefined);
            yield* Fiber.join(interrupt);
            return { interruptedBeforeNavigation };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result.interruptedBeforeNavigation).toBeUndefined();
        expect(navigated).toEqual(["review"]);
      })
  );

  it.effect("fails Start when its Review navigation fails", () =>
    Effect.gen(function* () {
      const flow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(walletScope),
        {
          execute: () =>
            Effect.fail(new WidgetNavigationError({ cause: "blocked" })),
        }
      );
      const failed = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          return yield* Effect.exit(service.start(intake));
        })
      ).pipe(Effect.provide(flow.layer));

      expect(failed._tag).toBe("Failure");
    })
  );

  it.effect("rejects disabled or non-owning Starts", () =>
    Effect.gen(function* () {
      const disabledFlow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(walletScope),
        { borrowEnabled: false }
      );
      const otherOwnerFlow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(
          new WalletScopeKey({ address: otherAddress, network: "base" })
        )
      );
      const start = Effect.scoped(
        Effect.gen(function* () {
          return yield* (yield* BorrowTransactionFlowService).start(intake);
        })
      );

      expect(yield* start.pipe(Effect.provide(disabledFlow.layer))).toEqual({
        _tag: "RejectedDisabled",
      });
      expect(yield* start.pipe(Effect.provide(otherOwnerFlow.layer))).toEqual({
        _tag: "RejectedOwner",
      });
    })
  );

  it.effect(
    "interrupts opening a Flow Session for another Wallet Scope Owner",
    () =>
      Effect.gen(function* () {
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope)
        );
        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const started = yield* service.start(intake);
            if (started._tag !== "Started") return yield* Effect.die("start");
            yield* flow.setWalletState(
              connectedWalletState(
                new WalletScopeKey({ address: otherAddress, network: "base" })
              )
            );
            return yield* Effect.exit(service.openSession(started.session));
          })
        ).pipe(Effect.provide(flow.layer));

        expect(Exit.hasInterrupts(exit)).toBe(true);
      })
  );

  it.effect(
    "reopens a revisited Flow Session without its previous reservation",
    () =>
      Effect.gen(function* () {
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope)
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const started = yield* service.start(intake);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const confirmed = yield* Effect.scoped(
              Effect.gen(function* () {
                const session = yield* service.openSession(started.session);
                const review = yield* session.acquireReview();
                return yield* review.confirm();
              })
            );
            const reopened = yield* service.openSession(started.session);
            return { confirmed, execution: yield* reopened.acquireExecution() };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result).toEqual({
          confirmed: { _tag: "Confirmed" },
          execution: { _tag: "RejectedNoReservation" },
        });
      })
  );

  it.effect(
    "rolls back only the active reservation on failed Steps navigation and retries Confirm fully",
    () =>
      Effect.gen(function* () {
        const commands: Array<WidgetNavigationCommand> = [];
        let failSteps = true;
        const executeAction = vi.fn(() => Effect.succeed(action()));
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: (command) =>
              Effect.suspend(() => {
                commands.push(command);
                if (
                  command._tag === "Push" &&
                  command.path.endsWith("/steps") &&
                  failSteps
                ) {
                  failSteps = false;
                  return Effect.fail(
                    new WidgetNavigationError({ cause: "blocked" })
                  );
                }
                return Effect.void;
              }),
            executeAction,
          }
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const review = yield* session.acquireReview();
            const failed = yield* Effect.exit(review.confirm());
            const retried = yield* review.confirm();
            const duplicate = yield* review.confirm();
            return { duplicate, failed, retried };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result.failed._tag).toBe("Failure");
        expect(result.retried).toEqual({ _tag: "Confirmed" });
        expect(result.duplicate).toEqual({ _tag: "RejectedAlreadyReserved" });
        expect(executeAction).toHaveBeenCalledTimes(2);
        expect(commands.map((command) => command._tag)).toEqual([
          "Push",
          "Push",
          "Push",
        ]);
      })
  );

  it.effect.each(["FAILED", "SUCCESS"])(
    "rejects immediately terminal %s actions as typed creation failures",
    (status) =>
      Effect.gen(function* () {
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            executeAction: () => Effect.succeed(action(status)),
          }
        );
        const error = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const review = yield* session.acquireReview();
            return yield* Effect.flip(review.confirm());
          })
        ).pipe(Effect.provide(flow.layer));
        expect(error).toBeInstanceOf(BorrowActionCreationError);
      })
  );

  it.effect("clears the reserved action when Review is acquired again", () =>
    Effect.gen(function* () {
      const flow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(walletScope)
      );
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const { session } = yield* acquireStartedSession(service);
          const review = yield* session.acquireReview();
          const confirmed = yield* review.confirm();
          yield* session.acquireReview();
          const execution = yield* session.acquireExecution();
          return { confirmed, execution };
        })
      ).pipe(Effect.provide(flow.layer));

      expect(result).toEqual({
        confirmed: { _tag: "Confirmed" },
        execution: { _tag: "RejectedNoReservation" },
      });
    })
  );

  it.effect(
    "keeps a committed Confirm reservation when the Review Scope closes during navigation",
    () =>
      Effect.gen(function* () {
        const navigationStarted = yield* Deferred.make<void>();
        const navigationRelease = yield* Deferred.make<void>();
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: (command) =>
              command._tag === "Push" &&
              command.path === toWidgetPath("/borrow/steps")
                ? Deferred.succeed(navigationStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(navigationRelease))
                  )
                : Effect.void,
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const reviewScope = yield* Scope.make();
            const review = yield* session
              .acquireReview()
              .pipe(Effect.provideService(Scope.Scope, reviewScope));
            const confirmation = yield* review.confirm().pipe(Effect.forkChild);
            yield* Deferred.await(navigationStarted);
            const close = yield* Scope.close(reviewScope, Exit.void).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            yield* Deferred.succeed(navigationRelease, undefined);
            yield* Fiber.join(close);
            yield* Fiber.await(confirmation);
            return yield* session.acquireExecution();
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result._tag).toBe("Acquired");
      })
  );

  it.effect("validates authoritative completion before Finish navigation", () =>
    Effect.gen(function* () {
      const commands: Array<WidgetNavigationCommand> = [];
      const workflowState =
        yield* SubscriptionRef.make<TransactionWorkflowState>(
          initializeTransactionWorkflow(
            new BorrowTransactionWorkflowInput({
              action: action(),
              walletScope,
            })
          )
        );
      const flow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(walletScope),
        {
          execute: (command) =>
            Effect.sync(() => {
              commands.push(command);
            }),
          makeWorkflow: (_input: TransactionWorkflowInput) =>
            Effect.succeed({
              dispatch: () => Effect.void,
              states: SubscriptionRef.changes(workflowState),
            }),
        }
      );
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const { session } = yield* acquireStartedSession(service);
          const review = yield* session.acquireReview();
          yield* review.confirm();
          const acquired = yield* session.acquireExecution();
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected Execution acquisition");
          }
          const early = yield* acquired.execution.finish();
          const current = yield* SubscriptionRef.get(workflowState);
          const completed: TransactionWorkflowState = {
            ...current,
            _tag: "Completed",
          };
          yield* SubscriptionRef.set(workflowState, completed);
          const accepted = yield* acquired.execution.finish();
          return { accepted, early };
        })
      ).pipe(Effect.provide(flow.layer));

      expect(result.early).toEqual({ _tag: "RejectedNotCompleted" });
      expect(result.accepted).toEqual({ _tag: "Accepted" });
      expect(commands).toContainEqual({
        _tag: "Replace",
        path: toWidgetPath("/borrow"),
      });
    })
  );

  it.effect(
    "retries automatic completion navigation every 100 milliseconds",
    () =>
      Effect.gen(function* () {
        let completionAttempts = 0;
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: (command) => {
              if (
                command._tag !== "Replace" ||
                command.path !== toWidgetPath("/borrow/complete")
              ) {
                return Effect.void;
              }
              completionAttempts += 1;
              return completionAttempts < 3
                ? Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
                : Effect.void;
            },
            makeWorkflow: (input) =>
              Effect.succeed({
                dispatch: () => Effect.void,
                states: Stream.succeed({
                  ...initializeTransactionWorkflow(input),
                  _tag: "Completed" as const,
                }),
              }),
          }
        );
        const attempts = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const review = yield* session.acquireReview();
            yield* review.confirm();
            const execution = yield* session.acquireExecution();
            if (execution._tag !== "Acquired") {
              return yield* Effect.die("Expected Execution acquisition");
            }
            yield* Effect.yieldNow;
            const initial = completionAttempts;
            yield* TestClock.adjust("99 millis");
            const beforeBoundary = completionAttempts;
            yield* TestClock.adjust("1 millis");
            const firstRetry = completionAttempts;
            yield* TestClock.adjust("100 millis");
            return {
              beforeBoundary,
              firstRetry,
              initial,
              success: completionAttempts,
            };
          })
        ).pipe(Effect.provide(Layer.mergeAll(TestClock.layer(), flow.layer)));

        expect(attempts).toEqual({
          beforeBoundary: 1,
          firstRetry: 2,
          initial: 1,
          success: 3,
        });
      })
  );

  it.effect(
    "interrupts an in-flight Confirm before it reserves or navigates when its Session Scope closes",
    () =>
      Effect.gen(function* () {
        const commands: Array<WidgetNavigationCommand> = [];
        const creationStarted = yield* Deferred.make<void>();
        const creationRelease = yield* Deferred.make<void>();
        const creationInterrupted = yield* Deferred.make<void>();
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
            executeAction: () =>
              Deferred.succeed(creationStarted, undefined).pipe(
                Effect.andThen(Deferred.await(creationRelease)),
                Effect.as(action()),
                Effect.onInterrupt(() =>
                  Deferred.succeed(creationInterrupted, undefined)
                )
              ),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const started = yield* service.start(intake);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const sessionScope = yield* Scope.make();
            const session = yield* service
              .openSession(started.session)
              .pipe(Scope.provide(sessionScope));
            const review = yield* session.acquireReview();
            const confirmation = yield* review
              .confirm()
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(creationStarted);
            const close = yield* Scope.close(sessionScope, Exit.void).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            yield* Deferred.succeed(creationRelease, undefined);
            yield* Fiber.join(close);
            const confirmed = yield* Fiber.await(confirmation);
            const back = yield* Effect.exit(review.back());
            return {
              back,
              confirmed,
              creationInterrupted: yield* Deferred.isDone(creationInterrupted),
            };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(Exit.hasInterrupts(result.confirmed)).toBe(true);
        expect(Exit.hasInterrupts(result.back)).toBe(true);
        expect(result.creationInterrupted).toBe(true);
        expect(commands.map((command) => command._tag)).toEqual(["Push"]);
      })
  );

  it.effect(
    "interrupts in-flight Execution work when Review is acquired again",
    () =>
      Effect.gen(function* () {
        const dispatchStarted = yield* Deferred.make<void>();
        const dispatchRelease = yield* Deferred.make<void>();
        const dispatched: Array<string> = [];
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            makeWorkflow: (input) =>
              Effect.succeed({
                dispatch: () =>
                  Deferred.succeed(dispatchStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(dispatchRelease)),
                    Effect.andThen(
                      Effect.sync(() => {
                        dispatched.push("completed");
                      })
                    )
                  ),
                states: Stream.succeed(initializeTransactionWorkflow(input)),
              }),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const review = yield* session.acquireReview();
            yield* review.confirm();
            const acquired = yield* session.acquireExecution();
            if (acquired._tag !== "Acquired") {
              return yield* Effect.die("Expected Execution acquisition");
            }
            const command = yield* acquired.execution
              .runWorkflow({ _tag: "Retry" })
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(dispatchStarted);
            const reentered = yield* session
              .acquireReview()
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Effect.yieldNow;
            yield* Deferred.succeed(dispatchRelease, undefined);
            yield* Fiber.join(reentered);
            return { command: yield* Fiber.await(command) };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(Exit.hasInterrupts(result.command)).toBe(true);
        expect(dispatched).toEqual([]);
      })
  );

  it.effect(
    "lets an in-flight Execution navigation finish before its Session Scope closes",
    () =>
      Effect.gen(function* () {
        const backStarted = yield* Deferred.make<void>();
        const backRelease = yield* Deferred.make<void>();
        const commands: Array<WidgetNavigationCommand> = [];
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }).pipe(
                Effect.andThen(
                  command._tag === "Replace" &&
                    command.path === toWidgetPath("/borrow")
                    ? Deferred.succeed(backStarted, undefined).pipe(
                        Effect.andThen(Deferred.await(backRelease))
                      )
                    : Effect.void
                )
              ),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const started = yield* service.start(intake);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const sessionScope = yield* Scope.make();
            const session = yield* service
              .openSession(started.session)
              .pipe(Scope.provide(sessionScope));
            const review = yield* session.acquireReview();
            yield* review.confirm();
            const acquired = yield* session.acquireExecution();
            if (acquired._tag !== "Acquired") {
              return yield* Effect.die("Expected Execution acquisition");
            }
            yield* acquired.execution
              .back()
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(backStarted);
            const close = yield* Scope.close(sessionScope, Exit.void).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            const closedWhileBackPending = close.pollUnsafe();
            yield* Deferred.succeed(backRelease, undefined);
            yield* Fiber.join(close);
            return { closedWhileBackPending };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result.closedWhileBackPending).toBeUndefined();
        expect(commands.map((command) => command._tag)).toEqual([
          "Push",
          "Push",
          "Replace",
        ]);
      })
  );
});
