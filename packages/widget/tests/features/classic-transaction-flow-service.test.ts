import { describe, expect, it, vi } from "@effect/vitest";
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
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import type { YieldOperations } from "../../src/services/api/operations";
import {
  ApiRequestError,
  InputValidationError,
} from "../../src/services/api/resource-sources";
import {
  toWidgetPath,
  type WidgetNavigation,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../src/services/navigation/widget-navigation";
import type { TrackingService } from "../../src/services/tracking/tracking-service";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import type { TransactionWorkflowInput } from "../../src/services/transaction-workflow/transaction-workflow-model";
import type { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
} from "../fixtures/wallet-state";
import { makeClassicFlowTestKit } from "../utils/classic-flow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const connectedWalletState = (scope: WalletScopeKey): WalletState =>
  makeConnectedWalletState(scope);

const connectingWalletState = (scope: WalletScopeKey): WalletState =>
  makeConnectingWalletState(scope);

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

const makeContinuationIntake = (
  action = yieldApiActionFixture()
): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "YieldActionContinuation" }
> => ({
  _tag: "YieldActionContinuation",
  action,
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

const makeManageIntake = (): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Manage" }
> => {
  const integration = yieldApiYieldFixture();

  return {
    _tag: "Manage",
    gasFeeToken: integration.mechanics.gasFeeToken,
    integration,
    interactedToken: integration.token,
    pendingActionType: "CLAIM_REWARDS",
    providersDetails: [],
    request: {
      action: "CLAIM_REWARDS",
      address: walletScope.address,
      passthrough: "claim-rewards",
      yieldId: integration.id,
    },
    walletScope,
  };
};

type ServiceOverrides = Readonly<{
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly trackEvent?: TrackingService["Service"]["trackEvent"];
}>;

const makeServiceLayer = (
  walletState: SubscriptionRef.SubscriptionRef<WalletState>,
  overrides: ServiceOverrides = {}
) =>
  Layer.unwrap(
    makeClassicFlowTestKit({
      makeWorkflow:
        overrides.makeWorkflow ??
        (() =>
          Effect.succeed({
            dispatch: () => Effect.void,
            states: Stream.never,
          })),
      navigation: overrides.execute ? { execute: overrides.execute } : {},
      previewAction:
        overrides.previewAction ??
        (() => Effect.succeed(yieldApiActionFixture())),
      tracking: overrides.trackEvent
        ? { trackEvent: overrides.trackEvent }
        : {},
      walletState,
    }).pipe(Effect.map((kit) => kit.layer))
  );

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
  it.effect(
    "reserves a fresh Session before navigation and rolls it back when navigation fails",
    () =>
      Effect.gen(function* () {
        const commands: Array<WidgetNavigationCommand> = [];
        const execute = vi.fn<WidgetNavigation["Service"]["execute"]>(
          (command) =>
            Effect.sync(() => {
              commands.push(command);
            }).pipe(
              Effect.andThen(
                Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
              )
            )
        );
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );
        const observedSessions: Array<unknown> = [];

        const exit = yield* Effect.exit(
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
        expect(commands).toEqual([
          { _tag: "Push", path: toWidgetPath("/review") },
        ]);
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
      })
  );

  it.effect(
    "finishes a committed Start when its caller is interrupted during navigation",
    () =>
      Effect.gen(function* () {
        const navigationStarted = yield* Deferred.make<void>();
        const navigationRelease = yield* Deferred.make<void>();
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const start = yield* startEnter(service).pipe(
              Effect.forkChild({ startImmediately: true })
            );
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
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: () =>
                Deferred.succeed(navigationStarted, undefined).pipe(
                  Effect.andThen(Deferred.await(navigationRelease))
                ),
            })
          )
        );

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
    "creates a fresh Session for every explicit Start with equal intake",
    () =>
      Effect.gen(function* () {
        const commands: Array<WidgetNavigationCommand> = [];
        const walletState = yield* SubscriptionRef.make<WalletState>(
          connectingWalletState(walletScope)
        );
        const input = {
          intake: makeEnterIntake(),
          mount: { _tag: "Earn" },
        } as const;

        const result = yield* Effect.scoped(
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
      })
  );

  it.effect(
    "rejects a stale Wallet owner and autonomously clears ownership changes",
    () =>
      Effect.gen(function* () {
        const otherScope = new WalletScopeKey({
          address: Schema.decodeSync(WalletAddress)(
            "0x2234567890123456789012345678901234567890"
          ),
          network: "ethereum",
        });
        const execute = vi.fn<WidgetNavigation["Service"]["execute"]>(
          () => Effect.void
        );
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(otherScope)
        );

        const result = yield* Effect.scoped(
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
            yield* SubscriptionRef.set(
              walletState,
              connectingWalletState(walletScope)
            );
            const retained = yield* service.currentSession.pipe(Stream.runHead);
            const invalidated = yield* service.currentSession.pipe(
              Stream.filter((session) => session === null),
              Stream.runHead,
              Effect.forkScoped({ startImmediately: true })
            );
            yield* SubscriptionRef.set(
              walletState,
              connectedWalletState(otherScope)
            );
            return {
              invalidated: yield* Fiber.join(invalidated),
              rejected,
              retained,
            };
          })
        ).pipe(Effect.provide(makeServiceLayer(walletState, { execute })));

        expect(result).toMatchObject({
          invalidated: Option.some(null),
          rejected: { _tag: "RejectedOwner" },
          retained: {
            _tag: "Some",
            value: { epoch: 1 },
          },
        });
        expect(execute).toHaveBeenCalledOnce();
      })
  );

  it.effect("does not let a released stale Session clear its replacement", () =>
    Effect.gen(function* () {
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const result = yield* Effect.scoped(
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
      ).pipe(Effect.provide(makeServiceLayer(walletState)));

      expect(result.current).toMatchObject({
        _tag: "Some",
        value: { epoch: result.second.session.epoch },
      });
    })
  );

  it.effect("keeps an invalid Exit preview in Review", () =>
    Effect.gen(function* () {
      const invalidAction = yieldApiActionFixture({
        transactions: [
          yieldApiTransactionFixture({
            id: "failed-transaction",
            status: "FAILED",
          }),
        ],
      });
      const commands: Array<WidgetNavigationCommand> = [];
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const result = yield* Effect.scoped(
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
      );

      expect(result).toMatchObject({
        confirmation: { _tag: "RejectedPreview" },
        execution: { _tag: "RejectedNoReservation" },
        state: {
          _tag: "Some",
          value: {
            preview: {
              _tag: "Failure",
              error: { _tag: "ClassicFlowInvalidPreviewError" },
            },
          },
        },
      });
      expect(commands).toHaveLength(1);
    })
  );

  it.effect("keeps an invalid Enter preview in Review", () =>
    Effect.gen(function* () {
      const invalidAction = yieldApiActionFixture({
        transactions: [
          yieldApiTransactionFixture({
            id: "blocked-transaction",
            status: "BLOCKED",
          }),
        ],
      });
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
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
            previewAction: () => Effect.succeed(invalidAction),
          })
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
              error: { _tag: "ClassicFlowInvalidPreviewError" },
            },
          },
        },
      });
    })
  );

  it.effect("keeps an invalid Manage preview in Review", () =>
    Effect.gen(function* () {
      const invalidAction = yieldApiActionFixture({
        transactions: [
          yieldApiTransactionFixture({
            id: "failed-transaction",
            status: "FAILED",
          }),
        ],
      });
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeManageIntake(),
            mount: {
              _tag: "PositionManage",
              balanceId: "balance",
              integrationId: "integration",
            },
          });
          if (started._tag !== "Started") {
            return yield* Effect.die("Expected a Classic Flow Session");
          }
          const acquired = yield* service.acquireSession(started.session);
          if (acquired._tag !== "Acquired") {
            return yield* Effect.die("Expected an acquired Session");
          }
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          const state = yield* review.states.pipe(
            Stream.filter((current) => current.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm();
          return { confirmation, state };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            previewAction: () => Effect.succeed(invalidAction),
          })
        )
      );

      expect(result).toMatchObject({
        confirmation: { _tag: "RejectedPreview" },
        state: {
          _tag: "Some",
          value: {
            preview: {
              _tag: "Failure",
              error: { _tag: "ClassicFlowInvalidPreviewError" },
            },
          },
        },
      });
    })
  );

  it.effect("reuses an already-active Yield Action Continuation Session", () =>
    Effect.gen(function* () {
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );
      const input = {
        intake: makeContinuationIntake(
          yieldApiActionFixture({ status: "WAITING_FOR_NEXT" })
        ),
        mount: { _tag: "YieldActionContinuation" as const },
      };

      const result = yield* Effect.gen(function* () {
        const service = yield* ClassicTransactionFlowService;
        const first = yield* service.start(input);
        const second = yield* service.start(input);
        return { first, second };
      }).pipe(Effect.provide(makeServiceLayer(walletState)));

      expect(result.first._tag).toBe("Started");
      expect(result.second).toEqual(result.first);
    })
  );

  it.effect(
    "allows a continuation to start again after its Session is released",
    () =>
      Effect.gen(function* () {
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );
        const input = {
          intake: makeContinuationIntake(
            yieldApiActionFixture({ status: "WAITING_FOR_NEXT" })
          ),
          mount: { _tag: "YieldActionContinuation" as const },
        };

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const first = yield* service.start(input);
            if (first._tag !== "Started") {
              return yield* Effect.die("Expected a Classic Flow Session");
            }

            yield* Effect.scoped(
              Effect.gen(function* () {
                const acquired = yield* service.acquireSession(first.session);
                if (acquired._tag !== "Acquired") {
                  return yield* Effect.die("Expected an acquired Session");
                }
              })
            );

            return yield* service.start(input);
          })
        ).pipe(Effect.provide(makeServiceLayer(walletState)));

        expect(result._tag).toBe("Started");
      })
  );

  it.effect(
    "continues the existing waiting Activity action without previewing another action",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({
          id: "waiting-manage-action",
          intent: "manage",
          status: "WAITING_FOR_NEXT",
          transactions: [
            yieldApiTransactionFixture({
              id: "waiting-transaction",
              status: "WAITING_FOR_SIGNATURE",
            }),
          ],
          type: "CLAIM_REWARDS",
        });
        const commands: Array<WidgetNavigationCommand> = [];
        const inputs: Array<TransactionWorkflowInput> = [];
        const previewAction = vi.fn(() => Effect.die("unexpected preview"));
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* service.start({
              intake: makeContinuationIntake(action),
              mount: {
                _tag: "YieldActionContinuation",
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
            const state = yield* review.states.pipe(
              Stream.filter((current) => current.preview._tag === "Success"),
              Stream.runHead
            );
            const confirmation = yield* review.confirm();
            const execution = yield* acquired.session.acquireExecution();
            if (execution._tag !== "Acquired") {
              return yield* Effect.die("Expected an Activity Execution");
            }
            const finish = yield* execution.execution.finish();

            return { confirmation, execution, finish, state };
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: (command) =>
                Effect.sync(() => {
                  commands.push(command);
                }),
              makeWorkflow: (input) =>
                Effect.sync(() => {
                  inputs.push(input);
                  return {
                    dispatch: () => Effect.void,
                    states: Stream.never,
                  };
                }),
              previewAction,
            })
          )
        );

        expect(result.state).toMatchObject({
          _tag: "Some",
          value: { preview: { _tag: "Success", action: { id: action.id } } },
        });
        expect(result.confirmation).toEqual({ _tag: "Confirmed" });
        expect(result.execution._tag).toBe("Acquired");
        expect(result.finish).toEqual({ _tag: "Accepted" });
        expect(previewAction).not.toHaveBeenCalled();
        expect(inputs).toMatchObject([
          {
            _tag: "Classic",
            actionMeta: { actionId: action.id },
            transactions: [{ id: "waiting-transaction" }],
          },
        ]);
        expect(commands).toEqual([
          {
            _tag: "Push",
            path: toWidgetPath(`/activity/${action.id}/steps`),
          },
          {
            _tag: "Push",
            path: toWidgetPath("/activity"),
          },
        ]);
      })
  );

  it.effect(
    "removes skipped transactions and preserves pending transactions",
    () =>
      Effect.gen(function* () {
        const executableTransaction = yieldApiTransactionFixture({
          id: "executable-transaction",
          status: "PENDING",
        });
        const preview = yieldApiActionFixture({
          transactions: [
            yieldApiTransactionFixture({
              id: "skipped-transaction",
              status: "SKIPPED",
            }),
            executableTransaction,
          ],
        });
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );
        let workflowInput: TransactionWorkflowInput | null = null;

        yield* Effect.scoped(
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
            yield* acquired.session.acquireExecution();
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              makeWorkflow: (input) =>
                Effect.sync(() => {
                  workflowInput = input;
                  return {
                    dispatch: () => Effect.void,
                    states: Stream.never,
                  };
                }),
              previewAction: () => Effect.succeed(preview),
            })
          )
        );

        expect(workflowInput).toMatchObject({
          _tag: "Classic",
          transactions: [{ id: executableTransaction.id, status: "PENDING" }],
        });
      })
  );

  it.live(
    "completes an all-skipped preview without an executable transaction",
    () =>
      Effect.gen(function* () {
        const preview = yieldApiActionFixture({
          transactions: [
            yieldApiTransactionFixture({
              id: "skipped-transaction",
              status: "SKIPPED",
            }),
          ],
        });
        const completionNavigation =
          yield* Deferred.make<WidgetNavigationCommand>();
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );
        let workflowInput: TransactionWorkflowInput | null = null;

        const command = yield* Effect.scoped(
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
            return yield* Deferred.await(completionNavigation);
          })
        ).pipe(
          Effect.timeout("1 second"),
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: (navigationCommand) =>
                navigationCommand._tag === "Replace" &&
                navigationCommand.path === toWidgetPath("/complete")
                  ? Deferred.succeed(completionNavigation, navigationCommand)
                  : Effect.void,
              makeWorkflow: (input) =>
                Effect.sync(() => {
                  workflowInput = input;
                  return {
                    dispatch: () => Effect.void,
                    states: Stream.succeed(
                      initializeTransactionWorkflow(input)
                    ),
                  };
                }),
              previewAction: () => Effect.succeed(preview),
            })
          )
        );

        expect(workflowInput).toMatchObject({
          _tag: "Classic",
          transactions: [],
        });
        expect(command).toMatchObject({
          _tag: "Replace",
          path: toWidgetPath("/complete"),
        });
      })
  );

  it.effect("rejects confirmation when Activity eligibility has expired", () =>
    Effect.gen(function* () {
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const started = yield* service.start({
            intake: makeContinuationIntake(
              yieldApiActionFixture({ status: "WAITING_FOR_NEXT" })
            ),
            mount: {
              _tag: "YieldActionContinuation",
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
      ).pipe(Effect.provide(makeServiceLayer(walletState)));

      expect(result).toEqual({
        confirmation: { _tag: "RejectedExpired" },
        execution: { _tag: "RejectedNoReservation" },
      });
    })
  );

  it.effect(
    "owns preview retry, promotion, workflow forwarding, Back, and Finish",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture();
        const commands: Array<WidgetNavigationCommand> = [];
        const workflowDispatch = vi.fn(() => Effect.void);
        let previewAttempts = 0;
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
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
                  ? Effect.fail(
                      new ApiRequestError({
                        cause: new Error("temporarily unavailable"),
                        operation: "previewAction",
                      })
                    )
                  : Effect.succeed(action);
              },
            })
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
      })
  );

  it.effect("does not retry an invalid Action Preview request", () =>
    Effect.gen(function* () {
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );
      let previewAttempts = 0;

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          const acquired = yield* acquireStartedSession(service);
          const review =
            yield* acquired.session.acquireReview(readyEligibility);
          const state = yield* review.states.pipe(
            Stream.filter((current) => current.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm();
          return { confirmation, state };
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            previewAction: () => {
              previewAttempts += 1;
              return Effect.fail(
                new InputValidationError({
                  cause: new Error("invalid amount"),
                  issue: "amount must be a decimal string",
                  operation: "previewAction",
                })
              );
            },
          })
        )
      );

      expect(result).toMatchObject({
        confirmation: { _tag: "RejectedPreview" },
        state: {
          _tag: "Some",
          value: {
            preview: {
              _tag: "Failure",
              error: {
                _tag: "ClassicFlowInvalidPreviewRequestError",
                retryable: false,
              },
            },
          },
        },
      });
      expect(previewAttempts).toBe(1);
    })
  );

  it.effect("revalidates eligibility after an in-flight preview retry", () =>
    Effect.gen(function* () {
      const retryStarted = yield* Deferred.make<void>();
      const retryRelease = yield* Deferred.make<void>();
      const eligibility = yield* SubscriptionRef.make({
        activityExpired: false,
        kycBlocking: false,
      });
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );
      let previewAttempts = 0;

      const result = yield* Effect.scoped(
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
                ? Effect.fail(
                    new ApiRequestError({
                      cause: new Error("temporarily unavailable"),
                      operation: "previewAction",
                    })
                  )
                : Deferred.succeed(retryStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(retryRelease)),
                    Effect.as(yieldApiActionFixture())
                  );
            },
          })
        )
      );

      expect(result).toEqual({
        execution: { _tag: "RejectedNoReservation" },
        outcome: { _tag: "RejectedBlocked" },
      });
    })
  );

  it.effect(
    "rolls back only the failed execution reservation and allows confirmation to retry",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture();
        const commands: Array<WidgetNavigationCommand> = [];
        let stepsAttempts = 0;
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
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
      })
  );

  it.effect(
    "suppresses stale Execution operations after a replacement Session starts",
    () =>
      Effect.gen(function* () {
        const workflowDispatch = vi.fn(() => Effect.void);
        const commands: Array<WidgetNavigationCommand> = [];
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
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
      })
  );

  it.effect(
    "serializes Execution navigation with replacement Session ownership",
    () =>
      Effect.gen(function* () {
        const backStarted = yield* Deferred.make<void>();
        const backRelease = yield* Deferred.make<void>();
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
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

            const back = yield* execution.execution
              .back()
              .pipe(Effect.forkChild);
            yield* Deferred.await(backStarted);
            const replacement = yield* startEnter(service).pipe(
              Effect.forkChild
            );
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
        );

        expect(result.back).toEqual({ _tag: "Accepted" });
        expect(result.replacement).toMatchObject({ _tag: "Started" });
        expect(result.replacementWhileBackPending).toBeUndefined();
        expect(result.whileBackPending).toMatchObject({
          _tag: "Some",
          value: { epoch: result.originalEpoch },
        });
      })
  );

  it.effect(
    "keeps a committed execution reservation when the Review Scope closes during navigation",
    () =>
      Effect.gen(function* () {
        const navigationStarted = yield* Deferred.make<void>();
        const navigationRelease = yield* Deferred.make<void>();
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
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
            const close = yield* Scope.close(reviewScope, Exit.void).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            yield* Deferred.succeed(navigationRelease, undefined);
            yield* Fiber.join(close);
            yield* Fiber.await(confirmation);
            return yield* acquired.session.acquireExecution();
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: (command) =>
                command._tag === "Push" &&
                command.path === toWidgetPath("/steps")
                  ? Deferred.succeed(navigationStarted, undefined).pipe(
                      Effect.andThen(Deferred.await(navigationRelease))
                    )
                  : Effect.void,
            })
          )
        );

        expect(result._tag).toBe("Acquired");
      })
  );

  it.live(
    "navigates an already-complete Activity execution with its transaction summary",
    () =>
      Effect.gen(function* () {
        const selectedYield = yieldApiYieldFixture();
        const historicalAction = yieldApiActionFixture({
          amount: "1",
          status: "WAITING_FOR_NEXT",
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
        const completionNavigation =
          yield* Deferred.make<WidgetNavigationCommand>();
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const command = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* service.start({
              intake: {
                _tag: "YieldActionContinuation",
                action: historicalAction,
                providersDetails: [],
                selectedValidators: [],
                selectedYield,
                walletScope,
              },
              mount: {
                _tag: "YieldActionContinuation",
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
                  toWidgetPath(`/activity/${historicalAction.id}/complete`)
                  ? Deferred.succeed(completionNavigation, navigationCommand)
                  : Effect.void,
              makeWorkflow: (input: TransactionWorkflowInput) =>
                Effect.succeed({
                  dispatch: () => Effect.void,
                  states: Stream.succeed(initializeTransactionWorkflow(input)),
                }),
            })
          )
        );

        expect(command).toEqual({
          _tag: "Replace",
          path: toWidgetPath(`/activity/${historicalAction.id}/complete`),
        });
      })
  );

  it.effect("retries completion navigation every 100 milliseconds", () =>
    Effect.gen(function* () {
      const action = yieldApiActionFixture();
      const completionCommands: Array<WidgetNavigationCommand> = [];
      let completionAttempts = 0;
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const attempts = yield* Effect.scoped(
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
      );

      expect(attempts).toEqual({
        beforeBoundary: 1,
        firstRetry: 2,
        initial: 1,
        success: 3,
      });
      expect(completionCommands).toHaveLength(3);
    })
  );
});
