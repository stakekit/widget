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
import type { BorrowTransactionFlowIntake } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
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

const acquireStartedSession = Effect.fn("test.acquireStartedBorrowSession")(
  function* (service: BorrowTransactionFlowService["Service"]) {
    const started = yield* service.start(intake);
    if (started._tag !== "Started") {
      return yield* Effect.die("Expected a started Borrow Flow Session");
    }
    const acquired = yield* service.acquireSession(started.session);
    if (acquired._tag !== "Acquired") {
      return yield* Effect.die("Expected an acquired Borrow Flow Session");
    }
    return { captured: started.session, session: acquired.session } as const;
  }
);

describe("BorrowTransactionFlowService", () => {
  it.effect(
    "creates a fresh Session and derives Review navigation from a copied intake",
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

        expect(result.first).toMatchObject({
          _tag: "Started",
          session: { epoch: 1 },
        });
        expect(result.second).toMatchObject({
          _tag: "Started",
          session: { epoch: 2 },
        });
        expect(
          result.second._tag === "Started" && result.second.session.intake
        ).not.toBe(intake);
        expect(commands).toEqual([
          { _tag: "Push", path: toWidgetPath("/borrow/review") },
          { _tag: "Push", path: toWidgetPath("/borrow/review") },
        ]);
      })
  );

  it.effect(
    "abandons the replacement Session when its derived Review navigation fails",
    () =>
      Effect.gen(function* () {
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: () =>
              Effect.fail(new WidgetNavigationError({ cause: "blocked" })),
          }
        );
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const failed = yield* Effect.exit(service.start(intake));
            const current = yield* service.currentSession.pipe(Stream.runHead);
            return { current, failed };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result.failed._tag).toBe("Failure");
        expect(result.current).toEqual(Option.some(null));
      })
  );

  it.effect(
    "finishes a committed Start when its caller is interrupted during navigation",
    () =>
      Effect.gen(function* () {
        const navigationStarted = yield* Deferred.make<void>();
        const navigationRelease = yield* Deferred.make<void>();
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          {
            execute: () =>
              Deferred.succeed(navigationStarted, undefined).pipe(
                Effect.andThen(Deferred.await(navigationRelease))
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
            const duringInterrupt = yield* service.currentSession.pipe(
              Stream.runHead
            );
            yield* Deferred.succeed(navigationRelease, undefined);
            yield* Fiber.join(interrupt);
            const afterNavigation = yield* service.currentSession.pipe(
              Stream.runHead
            );
            return { afterNavigation, duringInterrupt };
          })
        ).pipe(Effect.provide(flow.layer));

        expect(result.duringInterrupt).toMatchObject({
          _tag: "Some",
          value: { epoch: 1 },
        });
        expect(result.afterNavigation).toMatchObject({
          _tag: "Some",
          value: { epoch: 1 },
        });
      })
  );

  it.effect(
    "rejects disabled or non-owning Starts and clears an owner-invalidated Session",
    () =>
      Effect.gen(function* () {
        const disabledFlow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope),
          { borrowEnabled: false }
        );
        const flow = yield* makeBorrowFlowTestLayer(
          connectedWalletState(walletScope)
        );
        const disabled = yield* Effect.scoped(
          Effect.gen(function* () {
            return yield* (yield* BorrowTransactionFlowService).start(intake);
          })
        ).pipe(Effect.provide(disabledFlow.layer));
        expect(disabled).toEqual({ _tag: "RejectedDisabled" });

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const started = yield* service.start(intake);
            yield* flow.setWalletState(connectingWalletState(walletScope));
            const retained = yield* service.currentSession.pipe(Stream.runHead);
            yield* flow.setWalletState(
              connectedWalletState(
                new WalletScopeKey({ address: otherAddress, network: "base" })
              )
            );
            const cleared = yield* service.currentSession.pipe(
              Stream.filter((current) => current === null),
              Stream.runHead
            );
            const rejected = yield* service.start(intake);
            return { cleared, rejected, retained, started };
          })
        ).pipe(Effect.provide(flow.layer));
        expect(result.started._tag).toBe("Started");
        expect(result.retained).toMatchObject({
          _tag: "Some",
          value: { epoch: 1 },
        });
        expect(result.cleared).toEqual(Option.some(null));
        expect(result.rejected).toEqual({ _tag: "RejectedOwner" });
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

  it.effect("does not let a released stale Session clear its replacement", () =>
    Effect.gen(function* () {
      const flow = yield* makeBorrowFlowTestLayer(
        connectedWalletState(walletScope)
      );
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const first = yield* service.start(intake);
          if (first._tag !== "Started") return yield* Effect.die("first");
          const firstScope = yield* Scope.make();
          yield* service
            .acquireSession(first.session)
            .pipe(Effect.provideService(Scope.Scope, firstScope));
          const second = yield* service.start(intake);
          if (second._tag !== "Started") return yield* Effect.die("second");
          yield* Scope.close(firstScope, Exit.void);
          const current = yield* service.currentSession.pipe(Stream.runHead);
          return { current, second };
        })
      ).pipe(Effect.provide(flow.layer));
      expect(result.current).toMatchObject({
        _tag: "Some",
        value: { epoch: result.second.session.epoch },
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
});
