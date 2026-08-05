import BigNumber from "bignumber.js";
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
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../src/services/api/yield-operations";
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
  initializeTransactionWorkflow,
  type TransactionWorkflowInput,
} from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

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

const makeEnterIntake = (): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Enter" }
> => {
  const selectedStake = yieldApiYieldFixture();

  return {
    _tag: "Enter",
    gasFeeToken: selectedStake.mechanics.gasFeeToken,
    providersDetails: [{ name: "StakeKit" }],
    request: {
      address: walletScope.address,
      arguments: { amount: "1" },
      yieldId: selectedStake.id,
    },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

const makeActivityIntake = (): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "ActivityResume" }
> => ({
  _tag: "ActivityResume",
  action: yieldApiActionFixture(),
  providersDetails: [],
  selectedValidators: [],
  selectedYield: yieldApiYieldFixture(),
  walletScope,
});

const makeExitIntake = (): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Exit" }
> => {
  const integration = yieldApiYieldFixture();
  return {
    _tag: "Exit",
    gasFeeToken: integration.mechanics.gasFeeToken,
    integration,
    providersDetails: [],
    receiveToken: null,
    request: {
      address,
      arguments: { amount: "1" },
      yieldId: integration.id,
    },
    unstakeAmount: new BigNumber(1),
    unstakeToken: integration.token,
    walletScope,
  };
};

type ServiceOverrides = Readonly<{
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly previewAction?: (
    request: ActionPreviewRequest
  ) => Effect.Effect<ReturnType<typeof yieldApiActionFixture>, unknown>;
  readonly trackEvent?: TrackingService["Service"]["trackEvent"];
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
  const externalLayer = Layer.mergeAll(
    Layer.succeed(
      WalletService,
      WalletService.of({
        state: SubscriptionRef.get(walletState),
        states: SubscriptionRef.changes(walletState),
        wagmiConfig: {},
      } as never)
    ),
    Layer.succeed(WidgetNavigation, navigation),
    Layer.succeed(
      YieldOperations,
      YieldOperations.of({
        previewAction:
          overrides.previewAction ??
          (() => Effect.succeed(yieldApiActionFixture())),
      } as never)
    ),
    Layer.succeed(
      TrackingService,
      TrackingService.of({
        trackEvent: overrides.trackEvent ?? (() => Effect.void),
        trackPageView: () => Effect.void,
      })
    ),
    Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make:
          overrides.makeWorkflow ??
          (() =>
            Effect.succeed({
              dispatch: () => Effect.void,
              states: Stream.never,
            })),
      })
    )
  );

  return ClassicTransactionFlowService.layer.pipe(Layer.provide(externalLayer));
};

const startEnter = (service: ClassicTransactionFlowService["Service"]) =>
  service.start({ intake: makeEnterIntake(), mount: { _tag: "Earn" } });

const acquireStartedSession = Effect.fn("test.acquireStartedSession")(
  function* (service: ClassicTransactionFlowService["Service"]) {
    const started = yield* startEnter(service);
    if (started._tag !== "Started") {
      return yield* Effect.die("Expected a started Classic Flow Session");
    }
    const acquired = yield* service.acquireSession(started.session);
    if (acquired._tag !== "Acquired") {
      return yield* Effect.die("Expected an acquired Classic Flow Session");
    }
    return { captured: started.session, session: acquired.session } as const;
  }
);

const readyEligibility = Stream.succeed({
  activityExpired: false,
  kycBlocking: false,
});

describe("ClassicTransactionFlowService", () => {
  it("reserves a fresh Session before navigation and rolls it back when navigation fails", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    const execute = vi.fn<WidgetNavigation["Service"]["execute"]>((command) =>
      Effect.sync(() => {
        commands.push(command);
      }).pipe(
        Effect.andThen(
          Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
        )
      )
    );
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const observedSessions: Array<unknown> = [];

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          yield* service.currentSession.pipe(
            Stream.tap((session) =>
              Effect.sync(() => {
                observedSessions.push(session);
              })
            ),
            Stream.take(3),
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );

          return yield* startEnter(service);
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState, { execute })))
    );

    expect(exit._tag).toBe("Failure");
    expect(commands).toEqual([{ _tag: "Push", path: toWidgetPath("/review") }]);
    expect(observedSessions).toMatchObject([
      null,
      {
        destination: {
          completePath: "/complete",
          reviewPath: "/review",
          stepsPath: "/steps",
        },
        epoch: 1,
      },
      null,
    ]);
  });

  it("creates a fresh Session for every explicit Start with equal intake", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    const input = {
      intake: makeEnterIntake(),
      mount: { _tag: "Earn" },
    } as const;

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const first = yield* service.start(input);
          const second = yield* service.start(input);
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
    expect(commands).toEqual([
      { _tag: "Push", path: toWidgetPath("/review") },
      { _tag: "Push", path: toWidgetPath("/review") },
    ]);
  });

  it("rejects a stale Wallet owner and autonomously clears ownership changes", async () => {
    const otherScope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x2234567890123456789012345678901234567890"
      ),
      network: "ethereum",
    });
    const execute = vi.fn<WidgetNavigation["Service"]["execute"]>(
      () => Effect.void
    );
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(otherScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const rejected = yield* startEnter(service);
          yield* SubscriptionRef.set(
            walletState,
            connectedWalletState(walletScope)
          );
          const started = yield* startEnter(service);
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected a started Session");
          }
          const invalidated = yield* service.currentSession.pipe(
            Stream.filter((session) => session === null),
            Stream.runHead,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(
            walletState,
            connectedWalletState(otherScope)
          );
          return { invalidated: yield* Fiber.join(invalidated), rejected };
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState, { execute })))
    );

    expect(result).toEqual({
      invalidated: Option.some(null),
      rejected: { _tag: "RejectedOwner" },
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not let a released stale Session clear its replacement", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const first = yield* startEnter(service);
          if (first._tag !== "Started") {
            return yield* Effect.die("Expected the first Session");
          }
          const firstScope = yield* Scope.make();
          const acquired = yield* service
            .acquireSession(first.session)
            .pipe(Effect.provideService(Scope.Scope, firstScope));
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected the first Session acquisition");
          }
          const second = yield* startEnter(service);
          if (second._tag !== "Started") {
            return yield* Effect.die("Expected the replacement Session");
          }

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

  it("abandons only the captured Dashboard Activity Session", async () => {
    const commands: Array<WidgetNavigationCommand> = [];
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeActivityIntake(),
            mount: {
              _tag: "ActivityResume",
              presentation: "Dashboard",
              target: "HistoricalDetails",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected a Dashboard Activity Session");
          }
          const first = yield* service.abandonActivityResume(started.session);
          const duplicate = yield* service.abandonActivityResume(
            started.session
          );
          return { duplicate, first };
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

    expect(result).toEqual({
      duplicate: { _tag: "RejectedStale" },
      first: { _tag: "Abandoned" },
    });
    expect(commands).toEqual([
      { _tag: "Push", path: toWidgetPath("/activity") },
    ]);
  });

  it("keeps a Dashboard Activity Session when abandonment navigation fails", async () => {
    let attempts = 0;
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeActivityIntake(),
            mount: {
              _tag: "ActivityResume",
              presentation: "Dashboard",
              target: "HistoricalDetails",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected a Dashboard Activity Session");
          }

          const first = yield* Effect.exit(
            service.abandonActivityResume(started.session)
          );
          const retained = yield* service.currentSession.pipe(Stream.runHead);
          const retry = yield* service.abandonActivityResume(started.session);
          const cleared = yield* service.currentSession.pipe(Stream.runHead);

          return { cleared, first, retained, retry, session: started.session };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: () =>
              Effect.suspend(() => {
                attempts += 1;
                return attempts === 1
                  ? Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
                  : Effect.void;
              }),
          })
        )
      )
    );

    expect(Exit.isFailure(result.first)).toBe(true);
    expect(result.retained).toEqual(Option.some(result.session));
    expect(result.retry).toEqual({ _tag: "Abandoned" });
    expect(result.cleared).toEqual(Option.some(null));
    expect(attempts).toBe(2);
  });

  it("keeps an invalid Exit preview in Review", async () => {
    const invalidAction = yieldApiActionFixture({
      transactions: [
        yieldApiTransactionFixture({
          id: "failed-transaction",
          status: "FAILED",
        }),
      ],
    });
    const commands: Array<WidgetNavigationCommand> = [];
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeExitIntake(),
            mount: {
              _tag: "PositionExit",
              balanceId: "balance",
              integrationId: "integration",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected an Exit Session");
          }
          const acquired = yield* service.acquireSession(started.session);
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected an acquired Exit Session");
          }
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          const state = yield* review.states.pipe(
            Stream.filter((current) => current.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          return { confirmation, execution, state };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
            previewAction: () => Effect.succeed(invalidAction),
          })
        )
      )
    );

    expect(result).toMatchObject({
      confirmation: { _tag: "RejectedPreview" },
      execution: { _tag: "RejectedNoReservation" },
      state: {
        _tag: "Some",
        value: {
          preview: {
            _tag: "Failure",
            error: { _tag: "ClassicFlowInvalidExitPreviewError" },
          },
        },
      },
    });
    expect(commands).toHaveLength(1);
  });

  it("rejects confirmation when Activity eligibility has expired", async () => {
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeActivityIntake(),
            mount: {
              _tag: "ActivityResume",
              presentation: "Classic",
              target: "FreshReview",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected an Activity Session");
          }
          const acquired = yield* service.acquireSession(started.session);
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected an acquired Activity Session");
          }
          const review = yield* acquired.session.acquireReview(
            Stream.succeed({
              activityExpired: true,
              kycBlocking: false,
            })
          );
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          return { confirmation, execution };
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState)))
    );

    expect(result).toEqual({
      confirmation: { _tag: "RejectedExpired" },
      execution: { _tag: "RejectedNoReservation" },
    });
  });

  it("owns preview retry, promotion, workflow forwarding, Back, and Finish", async () => {
    const action = yieldApiActionFixture();
    const commands: Array<WidgetNavigationCommand> = [];
    const workflowDispatch = vi.fn(() => Effect.void);
    let previewAttempts = 0;
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          const failed = yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmed = yield* review.confirm();
          const duplicate = yield* review.confirm();
          const executionOutcome = yield* acquired.session.acquireExecution();
          if (executionOutcome._tag !== "Acquired") {
            return yield* Effect.die("Expected an Execution acquisition");
          }
          const workflow = yield* executionOutcome.execution.runWorkflow({
            _tag: "Retry",
          });
          const back = yield* executionOutcome.execution.back();
          const finish = yield* executionOutcome.execution.finish();
          return { back, confirmed, duplicate, failed, finish, workflow };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
            makeWorkflow: () =>
              Effect.succeed({
                dispatch: workflowDispatch,
                states: Stream.never,
              }),
            previewAction: () => {
              previewAttempts += 1;
              return previewAttempts === 1
                ? Effect.fail("temporarily unavailable")
                : Effect.succeed(action);
            },
          })
        )
      )
    );

    expect(result).toMatchObject({
      back: { _tag: "Accepted" },
      confirmed: { _tag: "Confirmed" },
      duplicate: { _tag: "RejectedSession" },
      failed: {
        _tag: "Some",
        value: { preview: { _tag: "Failure" } },
      },
      finish: { _tag: "Accepted" },
      workflow: { _tag: "Accepted" },
    });
    expect(previewAttempts).toBe(2);
    expect(workflowDispatch).toHaveBeenCalledWith({ _tag: "Retry" });
    expect(commands).toEqual([
      { _tag: "Push", path: toWidgetPath("/review") },
      { _tag: "Push", path: toWidgetPath("/steps") },
      { _tag: "Replace", path: toWidgetPath("/review") },
      { _tag: "Push", path: toWidgetPath("/") },
    ]);
  });

  it("revalidates eligibility after an in-flight preview retry", async () => {
    const retryStarted = await Effect.runPromise(Deferred.make<void>());
    const retryRelease = await Effect.runPromise(Deferred.make<void>());
    const eligibility = await Effect.runPromise(
      SubscriptionRef.make({ activityExpired: false, kycBlocking: false })
    );
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );
    let previewAttempts = 0;

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review = yield* acquired.session.acquireReview(
            SubscriptionRef.changes(eligibility)
          );
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm().pipe(Effect.forkChild);
          yield* Deferred.await(retryStarted);
          yield* SubscriptionRef.set(eligibility, {
            activityExpired: false,
            kycBlocking: true,
          });
          yield* Effect.yieldNow;
          yield* Effect.yieldNow;
          yield* Deferred.succeed(retryRelease, undefined);
          const outcome = yield* Fiber.join(confirmation);
          const execution = yield* acquired.session.acquireExecution();
          return { execution, outcome };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            previewAction: () => {
              previewAttempts += 1;
              return previewAttempts === 1
                ? Effect.fail("temporarily unavailable")
                : Deferred.succeed(retryStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(retryRelease)),
                    Effect.as(yieldApiActionFixture())
                  );
            },
          })
        )
      )
    );

    expect(result).toEqual({
      execution: { _tag: "RejectedNoReservation" },
      outcome: { _tag: "RejectedBlocked" },
    });
  });

  it("rolls back only the failed execution reservation and allows confirmation to retry", async () => {
    const action = yieldApiActionFixture();
    const commands: Array<WidgetNavigationCommand> = [];
    let stepsAttempts = 0;
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          const firstConfirmation = yield* review.confirm().pipe(Effect.exit);
          const afterFailure = yield* acquired.session.acquireExecution();
          const secondConfirmation = yield* review.confirm();
          const afterRetry = yield* acquired.session.acquireExecution();
          return {
            afterFailure,
            afterRetry: afterRetry._tag,
            firstConfirmation,
            secondConfirmation,
          };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) => {
              commands.push(command);
              if (
                command._tag === "Push" &&
                command.path === toWidgetPath("/steps")
              ) {
                stepsAttempts += 1;
                if (stepsAttempts === 1) {
                  return Effect.fail(
                    new WidgetNavigationError({ cause: "blocked" })
                  );
                }
              }
              return Effect.void;
            },
            previewAction: () => Effect.succeed(action),
          })
        )
      )
    );

    expect(Exit.isFailure(result.firstConfirmation)).toBe(true);
    expect(result.afterFailure).toEqual({
      _tag: "RejectedNoReservation",
    });
    expect(result.secondConfirmation).toEqual({ _tag: "Confirmed" });
    expect(result.afterRetry).toBe("Acquired");
    expect(commands).toEqual([
      { _tag: "Push", path: toWidgetPath("/review") },
      { _tag: "Push", path: toWidgetPath("/steps") },
      { _tag: "Push", path: toWidgetPath("/steps") },
    ]);
  });

  it("suppresses stale Execution operations after a replacement Session starts", async () => {
    const workflowDispatch = vi.fn(() => Effect.void);
    const commands: Array<WidgetNavigationCommand> = [];
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          if (execution._tag !== "Acquired") {
            return yield* Effect.die("Expected an Execution acquisition");
          }
          yield* startEnter(service);
          const workflow = yield* execution.execution.runWorkflow({
            _tag: "Retry",
          });
          const back = yield* execution.execution.back();
          const finish = yield* execution.execution.finish();
          return { back, finish, workflow };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }),
            makeWorkflow: () =>
              Effect.succeed({
                dispatch: workflowDispatch,
                states: Stream.never,
              }),
          })
        )
      )
    );

    expect(result).toEqual({
      back: { _tag: "RejectedStale" },
      finish: { _tag: "RejectedStale" },
      workflow: { _tag: "RejectedStale" },
    });
    expect(workflowDispatch).not.toHaveBeenCalled();
    expect(commands).toEqual([
      { _tag: "Push", path: toWidgetPath("/review") },
      { _tag: "Push", path: toWidgetPath("/steps") },
      { _tag: "Push", path: toWidgetPath("/review") },
    ]);
  });

  it("serializes Execution navigation with replacement Session ownership", async () => {
    const backStarted = await Effect.runPromise(Deferred.make<void>());
    const backRelease = await Effect.runPromise(Deferred.make<void>());
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          if (execution._tag !== "Acquired") {
            return yield* Effect.die("Expected an Execution acquisition");
          }

          const back = yield* execution.execution.back().pipe(Effect.forkChild);
          yield* Deferred.await(backStarted);
          const replacement = yield* startEnter(service).pipe(Effect.forkChild);
          yield* Effect.yieldNow;
          yield* Effect.yieldNow;
          const whileBackPending = yield* service.currentSession.pipe(
            Stream.runHead
          );
          const replacementWhileBackPending = replacement.pollUnsafe();
          yield* Deferred.succeed(backRelease, undefined);

          return {
            back: yield* Fiber.join(back),
            originalEpoch: acquired.captured.epoch,
            replacement: yield* Fiber.join(replacement),
            replacementWhileBackPending,
            whileBackPending,
          };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              command._tag === "Replace" &&
              command.path === toWidgetPath("/review")
                ? Deferred.succeed(backStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(backRelease))
                  )
                : Effect.void,
          })
        )
      )
    );

    expect(result.back).toEqual({ _tag: "Accepted" });
    expect(result.replacement).toMatchObject({ _tag: "Started" });
    expect(result.replacementWhileBackPending).toBeUndefined();
    expect(result.whileBackPending).toMatchObject({
      _tag: "Some",
      value: { epoch: result.originalEpoch },
    });
  });

  it("interrupts an in-flight Review operation and rolls back its reservation when the Review Scope closes", async () => {
    const navigationStarted = await Effect.runPromise(Deferred.make<void>());
    const navigationRelease = await Effect.runPromise(Deferred.make<void>());
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const reviewScope = yield* Scope.make();
          const review = yield* acquired.session
            .acquireReview(readyEligibility)
            .pipe(Effect.provideService(Scope.Scope, reviewScope));
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm().pipe(Effect.forkChild);
          yield* Deferred.await(navigationStarted);
          yield* Scope.close(reviewScope, Exit.void);
          const confirmationExit = yield* Fiber.await(confirmation);
          const execution = yield* acquired.session.acquireExecution();
          yield* Deferred.succeed(navigationRelease, undefined);
          return { confirmationExit, execution };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              command._tag === "Push" && command.path === toWidgetPath("/steps")
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

  it("navigates an already-complete Activity execution with its transaction summary", async () => {
    const selectedYield = yieldApiYieldFixture();
    const historicalAction = yieldApiActionFixture({
      amount: "1",
      type: "STAKE",
      yieldId: selectedYield.id,
    });
    const completedAction = yieldApiActionFixture({
      amount: "2",
      transactions: [
        yieldApiTransactionFixture({
          explorerUrl: "https://explorer.test/activity",
          status: "CONFIRMED",
          type: "STAKE",
        }),
      ],
      type: "STAKE",
      yieldId: selectedYield.id,
    });
    const completionNavigation = await Effect.runPromise(
      Deferred.make<WidgetNavigationCommand>()
    );
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const command = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: {
              _tag: "ActivityResume",
              action: historicalAction,
              providersDetails: [],
              selectedValidators: [],
              selectedYield,
              walletScope,
            },
            mount: {
              _tag: "ActivityResume",
              presentation: "Classic",
              target: "FreshReview",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected an Activity Session");
          }
          const acquired = yield* service.acquireSession(started.session);
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected an acquired Activity Session");
          }
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          if (execution._tag !== "Acquired") {
            return yield* Effect.die("Expected an Activity Execution");
          }

          return yield* Deferred.await(completionNavigation);
        })
      ).pipe(
        Effect.timeout("1 second"),
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (navigationCommand) =>
              navigationCommand._tag === "Replace" &&
              navigationCommand.path ===
                toWidgetPath("/activity/stake/complete")
                ? Deferred.succeed(completionNavigation, navigationCommand)
                : Effect.void,
            makeWorkflow: (input: TransactionWorkflowInput) =>
              Effect.succeed({
                dispatch: () => Effect.void,
                states: Stream.succeed(initializeTransactionWorkflow(input)),
              }),
            previewAction: () => Effect.succeed(completedAction),
          })
        )
      )
    );

    expect(command).toEqual({
      _tag: "Replace",
      path: toWidgetPath("/activity/stake/complete"),
      state: {
        urls: [
          {
            type: "STAKE",
            url: "https://explorer.test/activity",
          },
        ],
      },
    });
  });

  it("retries completion navigation every 100 milliseconds", async () => {
    const action = yieldApiActionFixture();
    const completionCommands: Array<WidgetNavigationCommand> = [];
    let completionAttempts = 0;
    const walletState = await Effect.runPromise(
      SubscriptionRef.make(connectedWalletState(walletScope))
    );

    const attempts = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          yield* review.states.pipe(
            Stream.filter((state) => state.preview._tag === "Success"),
            Stream.runHead
          );
          yield* review.confirm();
          const execution = yield* acquired.session.acquireExecution();
          if (execution._tag !== "Acquired") {
            return yield* Effect.die("Expected an Execution acquisition");
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
                  command.path !== toWidgetPath("/complete")
                ) {
                  return Effect.void;
                }
                completionAttempts += 1;
                completionCommands.push(command);
                return completionAttempts < 3
                  ? Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
                  : Effect.void;
              },
              makeWorkflow: (input: TransactionWorkflowInput) =>
                Effect.succeed({
                  dispatch: () => Effect.void,
                  states: Stream.succeed({
                    ...initializeTransactionWorkflow(input),
                    _tag: "Completed" as const,
                  }),
                }),
              previewAction: () => Effect.succeed(action),
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
    expect(completionCommands).toHaveLength(3);
  });
});
