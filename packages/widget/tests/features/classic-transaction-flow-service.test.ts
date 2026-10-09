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
import {
  type ClassicTransactionFlowIntake,
  decodeClassicFlowNavigationState,
  makeYieldActionContinuationSession,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
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

// The flow route opens the Session it was navigated to, in its own Scope.
const acquireStartedSession = Effect.fn("test.acquireStartedSession")(
  function* (service: ClassicTransactionFlowService["Service"]) {
    const started = yield* startEnter(service);
    if (started._tag !== "Started") {
      return yield* Effect.die("Expected a started Classic Flow Session");
    }
    const session = yield* service.openSession(started.session);
    return { session } as const;
  }
);

// Start's Review navigation carries the Session as state; flow assertions
// compare routes only.
const withoutNavigationState = (
  commands: ReadonlyArray<WidgetNavigationCommand>
) => commands.map(({ state: _state, ...command }) => command);

const readyEligibility = Stream.succeed({
  activityExpired: false,
  kycBlocking: false,
});

describe("ClassicTransactionFlowService", () => {
  it.effect(
    "navigates to Review carrying a fresh Flow Session with a copied intake",
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

        if (
          result.first._tag !== "Started" ||
          result.second._tag !== "Started"
        ) {
          throw new Error("Expected started Classic Flow Sessions");
        }
        expect(result.first.session).not.toBe(result.second.session);
        expect(result.second.session.intake).toEqual(input.intake);
        expect(result.second.session.intake).not.toBe(input.intake);
        expect(result.second.session.intake.walletScope).toEqual(walletScope);
        expect(result.second.session.intake.walletScope).not.toBe(
          input.intake.walletScope
        );
        expect(result.second.session.destination).toEqual({
          completePath: toWidgetPath("/complete"),
          reviewPath: toWidgetPath("/review"),
          stepsPath: toWidgetPath("/steps"),
        });
        expect(
          commands.map((command) => ({
            _tag: command._tag,
            path: command._tag === "Back" ? null : command.path,
            session: Option.getOrNull(
              decodeClassicFlowNavigationState(command.state)
            ),
          }))
        ).toEqual([
          {
            _tag: "Push",
            path: toWidgetPath("/review"),
            session: result.first.session,
          },
          {
            _tag: "Push",
            path: toWidgetPath("/review"),
            session: result.second.session,
          },
        ]);
      })
  );

  it.effect("fails Start when its Review navigation fails", () =>
    Effect.gen(function* () {
      const commands: Array<WidgetNavigationCommand> = [];
      const walletState = yield* SubscriptionRef.make(
        connectedWalletState(walletScope)
      );

      const exit = yield* Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ClassicTransactionFlowService;
          return yield* Effect.exit(startEnter(service));
        })
      ).pipe(
        Effect.provide(
          makeServiceLayer(walletState, {
            execute: (command) =>
              Effect.sync(() => {
                commands.push(command);
              }).pipe(
                Effect.andThen(
                  Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
                )
              ),
          })
        )
      );

      expect(exit._tag).toBe("Failure");
      expect(withoutNavigationState(commands)).toEqual([
        { _tag: "Push", path: toWidgetPath("/review") },
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
            const interruptedBeforeNavigation = interrupt.pollUnsafe();
            yield* Deferred.succeed(navigationRelease, undefined);
            yield* Fiber.join(interrupt);
            return { interruptedBeforeNavigation };
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: () =>
                Deferred.succeed(navigationStarted, undefined).pipe(
                  Effect.andThen(Deferred.await(navigationRelease)),
                  Effect.andThen(
                    Effect.sync(() => {
                      navigated.push("review");
                    })
                  )
                ),
            })
          )
        );

        expect(result.interruptedBeforeNavigation).toBeUndefined();
        expect(navigated).toEqual(["review"]);
      })
  );

  it.effect("rejects a Start for a non-owning Wallet without navigating", () =>
    Effect.gen(function* () {
      const otherAddress = yield* Schema.decodeEffect(WalletAddress)(
        "0x2234567890123456789012345678901234567890"
      );
      const otherScope = new WalletScopeKey({
        address: otherAddress,
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
          return yield* startEnter(service);
        })
      ).pipe(Effect.provide(makeServiceLayer(walletState, { execute })));

      expect(result).toEqual({ _tag: "RejectedOwner" });
      expect(execute).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "interrupts opening a Flow Session for another Wallet Scope Owner",
    () =>
      Effect.gen(function* () {
        const otherAddress = yield* Schema.decodeEffect(WalletAddress)(
          "0x2234567890123456789012345678901234567890"
        );
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* startEnter(service);
            if (started._tag !== "Started") return yield* Effect.die("start");
            yield* SubscriptionRef.set(
              walletState,
              connectedWalletState(
                new WalletScopeKey({
                  address: otherAddress,
                  network: "ethereum",
                })
              )
            );
            return yield* Effect.exit(service.openSession(started.session));
          })
        ).pipe(Effect.provide(makeServiceLayer(walletState)));

        expect(Exit.hasInterrupts(exit)).toBe(true);
      })
  );

  it.effect(
    "reopens a revisited Flow Session without its previous reservation",
    () =>
      Effect.gen(function* () {
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* startEnter(service);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const confirmed = yield* Effect.scoped(
              Effect.gen(function* () {
                const session = yield* service.openSession(started.session);
                const review = yield* session.acquireReview(readyEligibility);
                yield* review.states.pipe(
                  Stream.filter((state) => state.preview._tag === "Success"),
                  Stream.runHead
                );
                return yield* review.confirm();
              })
            );
            const reopened = yield* service.openSession(started.session);
            return { confirmed, execution: yield* reopened.acquireExecution() };
          })
        ).pipe(Effect.provide(makeServiceLayer(walletState)));

        expect(result).toEqual({
          confirmed: { _tag: "Confirmed" },
          execution: { _tag: "RejectedNoReservation" },
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
          const session = yield* service.openSession(started.session);
          const review = yield* session.acquireReview(readyEligibility);
          const state = yield* review.states.pipe(
            Stream.filter((current) => current.preview._tag === "Failure"),
            Stream.runHead
          );
          const confirmation = yield* review.confirm();
          const execution = yield* session.acquireExecution();
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
          const session = yield* service.openSession(started.session);
          const review = yield* session.acquireReview(readyEligibility);
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
            const session = yield* service.openSession(
              makeYieldActionContinuationSession(makeContinuationIntake(action))
            );
            const review = yield* session.acquireReview(readyEligibility);
            const state = yield* review.states.pipe(
              Stream.filter((current) => current.preview._tag === "Success"),
              Stream.runHead
            );
            const confirmation = yield* review.confirm();
            const execution = yield* session.acquireExecution();
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
        expect(result.finish).toBeUndefined();
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
          const session = yield* service.openSession(
            makeYieldActionContinuationSession(
              makeContinuationIntake(
                yieldApiActionFixture({ status: "WAITING_FOR_NEXT" })
              )
            )
          );
          const review = yield* session.acquireReview(
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
          const execution = yield* session.acquireExecution();
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
          back: undefined,
          confirmed: { _tag: "Confirmed" },
          duplicate: { _tag: "RejectedSession" },
          failed: {
            _tag: "Some",
            value: { preview: { _tag: "Failure" } },
          },
          finish: undefined,
          workflow: undefined,
        });
        expect(previewAttempts).toBe(2);
        expect(workflowDispatch).toHaveBeenCalledWith({ _tag: "Retry" });
        expect(withoutNavigationState(commands)).toEqual([
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
        expect(withoutNavigationState(commands)).toEqual([
          { _tag: "Push", path: toWidgetPath("/review") },
          { _tag: "Push", path: toWidgetPath("/steps") },
          { _tag: "Push", path: toWidgetPath("/steps") },
        ]);
      })
  );

  it.effect(
    "interrupts Execution operations after its Session Scope closes",
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
            const started = yield* startEnter(service);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const sessionScope = yield* Scope.make();
            const session = yield* service
              .openSession(started.session)
              .pipe(Scope.provide(sessionScope));
            const review = yield* session.acquireReview(readyEligibility);
            yield* review.states.pipe(
              Stream.filter((state) => state.preview._tag === "Success"),
              Stream.runHead
            );
            yield* review.confirm();
            const execution = yield* session.acquireExecution();
            if (execution._tag !== "Acquired") {
              return yield* Effect.die("Expected an Execution acquisition");
            }
            yield* Scope.close(sessionScope, Exit.void);
            const workflow = yield* Effect.exit(
              execution.execution.runWorkflow({ _tag: "Retry" })
            );
            const back = yield* Effect.exit(execution.execution.back());
            const finish = yield* Effect.exit(execution.execution.finish());
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

        expect(Exit.hasInterrupts(result.back)).toBe(true);
        expect(Exit.hasInterrupts(result.finish)).toBe(true);
        expect(Exit.hasInterrupts(result.workflow)).toBe(true);
        expect(workflowDispatch).not.toHaveBeenCalled();
        expect(withoutNavigationState(commands)).toEqual([
          { _tag: "Push", path: toWidgetPath("/review") },
          { _tag: "Push", path: toWidgetPath("/steps") },
        ]);
      })
  );

  it.effect(
    "interrupts an in-flight Confirm before it reserves or navigates when its Session Scope closes",
    () =>
      Effect.gen(function* () {
        const retryStarted = yield* Deferred.make<void>();
        const retryRelease = yield* Deferred.make<void>();
        const retryInterrupted = yield* Deferred.make<void>();
        const commands: Array<WidgetNavigationCommand> = [];
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );
        let previewAttempts = 0;

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* startEnter(service);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const sessionScope = yield* Scope.make();
            const session = yield* service
              .openSession(started.session)
              .pipe(Scope.provide(sessionScope));
            const review = yield* session.acquireReview(readyEligibility);
            yield* review.states.pipe(
              Stream.filter((state) => state.preview._tag === "Failure"),
              Stream.runHead
            );
            const confirmation = yield* review
              .confirm()
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(retryStarted);
            const close = yield* Scope.close(sessionScope, Exit.void).pipe(
              Effect.forkChild({ startImmediately: true })
            );
            yield* Effect.yieldNow;
            yield* Deferred.succeed(retryRelease, undefined);
            yield* Fiber.join(close);
            return {
              confirmation: yield* Fiber.await(confirmation),
              retryInterrupted: yield* Deferred.isDone(retryInterrupted),
            };
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: (command) =>
                Effect.sync(() => {
                  commands.push(command);
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
                  : Deferred.succeed(retryStarted, undefined).pipe(
                      Effect.andThen(Deferred.await(retryRelease)),
                      Effect.as(yieldApiActionFixture()),
                      Effect.onInterrupt(() =>
                        Deferred.succeed(retryInterrupted, undefined)
                      )
                    );
              },
            })
          )
        );

        expect(Exit.hasInterrupts(result.confirmation)).toBe(true);
        expect(result.retryInterrupted).toBe(true);
        expect(withoutNavigationState(commands)).toEqual([
          { _tag: "Push", path: toWidgetPath("/review") },
        ]);
      })
  );

  it.effect(
    "interrupts in-flight Execution work when Review is acquired again",
    () =>
      Effect.gen(function* () {
        const dispatchStarted = yield* Deferred.make<void>();
        const dispatchRelease = yield* Deferred.make<void>();
        const dispatched: Array<string> = [];
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
            const command = yield* execution.execution
              .runWorkflow({ _tag: "Retry" })
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Deferred.await(dispatchStarted);
            const reentered = yield* acquired.session
              .acquireReview(readyEligibility)
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* Effect.yieldNow;
            yield* Deferred.succeed(dispatchRelease, undefined);
            yield* Fiber.join(reentered);
            return { command: yield* Fiber.await(command) };
          })
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              makeWorkflow: () =>
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
                  states: Stream.never,
                }),
            })
          )
        );

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
        const walletState = yield* SubscriptionRef.make(
          connectedWalletState(walletScope)
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ClassicTransactionFlowService;
            const started = yield* startEnter(service);
            if (started._tag !== "Started") return yield* Effect.die("start");
            const sessionScope = yield* Scope.make();
            const session = yield* service
              .openSession(started.session)
              .pipe(Scope.provide(sessionScope));
            const review = yield* session.acquireReview(readyEligibility);
            yield* review.states.pipe(
              Stream.filter((state) => state.preview._tag === "Success"),
              Stream.runHead
            );
            yield* review.confirm();
            const execution = yield* session.acquireExecution();
            if (execution._tag !== "Acquired") {
              return yield* Effect.die("Expected an Execution acquisition");
            }

            yield* execution.execution
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
        ).pipe(
          Effect.provide(
            makeServiceLayer(walletState, {
              execute: (command) =>
                Effect.sync(() => {
                  commands.push(command);
                }).pipe(
                  Effect.andThen(
                    command._tag === "Replace" &&
                      command.path === toWidgetPath("/review")
                      ? Deferred.succeed(backStarted, undefined).pipe(
                          Effect.andThen(Deferred.await(backRelease))
                        )
                      : Effect.void
                  )
                ),
            })
          )
        );

        expect(result.closedWhileBackPending).toBeUndefined();
        expect(withoutNavigationState(commands)).toEqual([
          { _tag: "Push", path: toWidgetPath("/review") },
          { _tag: "Push", path: toWidgetPath("/steps") },
          { _tag: "Replace", path: toWidgetPath("/review") },
        ]);
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
            const session = yield* service.openSession(
              makeYieldActionContinuationSession({
                _tag: "YieldActionContinuation",
                action: historicalAction,
                providersDetails: [],
                selectedValidators: [],
                selectedYield,
                walletScope,
              })
            );
            const review = yield* session.acquireReview(readyEligibility);
            yield* review.states.pipe(
              Stream.filter((state) => state.preview._tag === "Success"),
              Stream.runHead
            );
            yield* review.confirm();
            const execution = yield* session.acquireExecution();
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
