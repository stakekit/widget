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
import { describe, expect, it, vi } from "vitest";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { BorrowTransactionFlowIntake } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { BorrowActionCreationError } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-flow-review";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import {
  makeWidgetNavigation,
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  BorrowTransactionWorkflowInput,
  initializeTransactionWorkflow,
  type TransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
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
  },
};

const transaction = (id = "tx-1"): Transaction =>
  Schema.decodeUnknownSync(Transaction)({
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

const connectedWalletState = (scope: WalletScopeKey): WalletState => ({
  connection: {
    additionalAddresses: scope.additionalAddresses,
    address: scope.address,
    chain: {} as never,
    connector: {} as never,
    connectorChains: [],
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
    network: scope.network,
    status: "connected",
  } satisfies NormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
});

type ServiceOverrides = Readonly<{
  readonly borrowEnabled?: boolean;
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly executeAction?: BorrowOperations["Service"]["executeAction"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
}>;

const makeServiceLayer = (
  walletState: SubscriptionRef.SubscriptionRef<WalletState>,
  overrides: ServiceOverrides = {}
) => {
  const execute = overrides.execute ?? (() => Effect.void);
  const navigation = makeWidgetNavigation({
    back: (options) => execute({ ...options, _tag: "Back" }),
    push: (path, options) => execute({ ...options, _tag: "Push", path }),
    replace: (path, options) => execute({ ...options, _tag: "Replace", path }),
  });
  const config = { borrowEnabled: overrides.borrowEnabled ?? true } as never;
  const dependencies = Layer.mergeAll(
    WidgetConfigService.layer({
      changes: Stream.succeed(config),
      current: Effect.succeed(config),
      initial: config,
    }),
    Layer.succeed(WidgetNavigation, navigation),
    Layer.succeed(
      WalletService,
      WalletService.of({
        state: SubscriptionRef.get(walletState),
        states: SubscriptionRef.changes(walletState),
        wagmiConfig: {},
      } as never)
    ),
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction:
          overrides.executeAction ?? (() => Effect.succeed(action())),
      } as never)
    ),
    Layer.succeed(
      TrackingService,
      TrackingService.of({
        trackEvent: () => Effect.void,
        trackPageView: () => Effect.void,
      })
    ),
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
  return BorrowTransactionFlowService.layer.pipe(Layer.provide(dependencies));
};

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
  it("creates a fresh Session and derives Review navigation from immutable intake", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const first = yield* service.start(intake);
          const second = yield* service.start(intake);
          return { first, second };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
          })
        )
      )
    );

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
  });

  it("abandons the replacement Session when its derived Review navigation fails", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const failed = yield* Effect.exit(service.start(intake));
          const current = yield* service.currentSession.pipe(Stream.runHead);
          return { current, failed };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: () =>
              Effect.fail(new WidgetNavigationError({ cause: "blocked" })),
          })
        )
      )
    );

    expect(result.failed._tag).toBe("Failure");
    expect(result.current).toEqual(Option.some(null));
  });

  it("rejects disabled or non-owning Starts and clears an owner-invalidated Session", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const disabled = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          return yield* (yield* BorrowTransactionFlowService).start(intake);
        })
      ).pipe(
        Effect.provide(makeServiceLayer(walletState, { borrowEnabled: false }))
      )
    );
    expect(disabled).toEqual({ _tag: "RejectedDisabled" });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const started = yield* service.start(intake);
          yield* SubscriptionRef.set(
            walletState,
            connectedWalletState(
              new WalletScopeKey({ address: otherAddress, network: "base" })
            )
          );
          const cleared = yield* service.currentSession.pipe(
            Stream.filter((current) => current === null),
            Stream.runHead
          );
          const rejected = yield* service.start(intake);
          return { cleared, rejected, started };
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState)))
    );
    expect(result.started._tag).toBe("Started");
    expect(result.cleared).toEqual(Option.some(null));
    expect(result.rejected).toEqual({ _tag: "RejectedOwner" });
  });

  it("rolls back only the active reservation on failed Steps navigation and retries Confirm fully", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    let failSteps = true;
    const executeAction = vi.fn(() => Effect.succeed(action()));
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const { session } = yield* acquireStartedSession(service);
          const review = yield* session.acquireReview();
          const failed = yield* Effect.exit(review.confirm());
          const retried = yield* review.confirm();
          const duplicate = yield* review.confirm();
          return { duplicate, failed, retried };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
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
          })
        )
      )
    );

    expect(result.failed._tag).toBe("Failure");
    expect(result.retried).toEqual({ _tag: "Confirmed" });
    expect(result.duplicate).toEqual({ _tag: "RejectedAlreadyReserved" });
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect(commands.map((command) => command._tag)).toEqual([
      "Push",
      "Push",
      "Push",
    ]);
  });

  it.each(["FAILED", "SUCCESS"])(
    "rejects immediately terminal %s actions as typed creation failures",
    async (status) => {
      const walletState = await Effect.runPromise(
        SubscriptionRef.make(connectedWalletState(walletScope))
      );
      const error = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const service = yield* BorrowTransactionFlowService;
            const { session } = yield* acquireStartedSession(service);
            const review = yield* session.acquireReview();
            return yield* Effect.flip(review.confirm());
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              executeAction: () => Effect.succeed(action(status)),
            })
          )
        )
      );
      expect(error).toBeInstanceOf(BorrowActionCreationError);
    }
  );

  it("clears the reserved action when Review is acquired again", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const { session } = yield* acquireStartedSession(service);
          const review = yield* session.acquireReview();
          const confirmed = yield* review.confirm();
          yield* session.acquireReview();
          const execution = yield* session.acquireExecution();
          return { confirmed, execution };
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState)))
    );

    expect(result).toEqual({
      confirmed: { _tag: "Confirmed" },
      execution: { _tag: "RejectedNoReservation" },
    });
  });

  it("interrupts in-flight Confirm navigation and rolls back its reservation", async () => {
    const navigationStarted = await Effect.runPromise(Deferred.make<void>());
    const navigationRelease = await Effect.runPromise(Deferred.make<void>());
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowTransactionFlowService;
          const { session } = yield* acquireStartedSession(service);
          const reviewScope = yield* Scope.make();
          const review = yield* session
            .acquireReview()
            .pipe(Effect.provideService(Scope.Scope, reviewScope));
          const confirmation = yield* review.confirm().pipe(Effect.forkChild);
          yield* Deferred.await(navigationStarted);
          yield* Scope.close(reviewScope, Exit.void);
          const confirmationExit = yield* Fiber.await(confirmation);
          const execution = yield* session.acquireExecution();
          yield* Deferred.succeed(navigationRelease, undefined);
          return { confirmationExit, execution };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              command._tag === "Push" &&
              command.path === toWidgetPath("/borrow/steps")
                ? Deferred.succeed(navigationStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(navigationRelease))
                  )
                : Effect.void,
          })
        )
      )
    );

    expect(Exit.hasInterrupts(result.confirmationExit)).toBe(true);
    expect(result.execution).toEqual({ _tag: "RejectedNoReservation" });
  });

  it("validates authoritative completion before Finish navigation", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    const workflowState = await Effect.runPromise(
      SubscriptionRef.make<TransactionWorkflowState>(
        initializeTransactionWorkflow(
          new BorrowTransactionWorkflowInput({ action: action(), walletScope })
        )
      )
    );
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
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
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
            makeWorkflow: (_input: TransactionWorkflowInput) =>
              Effect.succeed({
                dispatch: () => Effect.void,
                states: SubscriptionRef.changes(workflowState),
              }),
          })
        )
      )
    );

    expect(result.early).toEqual({ _tag: "RejectedNotCompleted" });
    expect(result.accepted).toEqual({ _tag: "Accepted" });
    expect(commands).toContainEqual({
      _tag: "Replace",
      path: toWidgetPath("/borrow"),
    });
  });

  it("does not let a released stale Session clear its replacement", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const result = await Effect.runPromise(
      Effect.scoped(
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
      ).pipe(Effect.provide(makeServiceLayer(walletState)))
    );
    expect(result.current).toMatchObject({
      _tag: "Some",
      value: { epoch: result.second.session.epoch },
    });
  });

  it("retries automatic completion navigation every 100 milliseconds", async () => {
    let completionAttempts = 0;
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const attempts = await Effect.runPromise(
      Effect.scoped(
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
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestClock.layer(),
            makeServiceLayer(walletState, {
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
            })
          )
        )
      )
    );

    expect(attempts).toEqual({
      beforeBoundary: 1,
      firstRetry: 2,
      initial: 1,
      success: 3,
    });
  });
});
