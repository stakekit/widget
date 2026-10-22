import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Ref,
  Schema,
  Scope,
  Stream,
} from "effect";
import type { YieldAction } from "../../../src/domain/action/models";
import {
  TransactionWorkflowId,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  ClassicFlowHandoff,
  type ClassicFlowSession,
  type ClassicTransactionFlowIntake,
  decodeClassicFlowExecutionHandoff,
  decodeClassicFlowNavigationState,
  makeClassicFlowNavigationState,
  makeClassicFlowSession,
  makeYieldActionContinuationSession,
  type NavigatingClassicTransactionFlowStart,
} from "../../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  leaveClassicFlowExecution,
  startClassicFlowExecution,
} from "../../../src/features/classic-transaction-flow/state/execution-page";
import {
  handOffClassicFlowSource,
  previewClassicFlowAction,
} from "../../../src/features/classic-transaction-flow/state/review-page";
import { makeStartClassicTransactionFlow } from "../../../src/features/classic-transaction-flow/state/start-flow";
import type { YieldOperations } from "../../../src/services/api/operations";
import {
  ApiRequestError,
  InputValidationError,
} from "../../../src/services/api/resource-sources";
import {
  toWidgetPath,
  type WidgetNavigation,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../../src/services/navigation/widget-navigation";
import { initializeTransactionWorkflow } from "../../../src/services/transaction-workflow/internal/model";
import {
  type TransactionWorkflowInput,
  TransactionWorkflowInputError,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import type {
  TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../src/services/transaction-workflow/transaction-workflow-service";
import type { WalletState } from "../../../src/services/wallet/wallet-state";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
} from "../../fixtures/wallet-state";
import { makeClassicFlowTestKit } from "../../utils/classic-flow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x2234567890123456789012345678901234567890"
  ),
  network: "ethereum",
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
    selectedProviderOption: null,
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

const makeContinuationIntake = (
  action = yieldApiActionFixture({ status: "WAITING_FOR_NEXT" })
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
    balanceType: "claimable",
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

const enterStart = (): NavigatingClassicTransactionFlowStart => ({
  intake: makeEnterIntake(),
  mount: { _tag: "Earn" },
});

const exitStart = (): NavigatingClassicTransactionFlowStart => ({
  intake: makeExitIntake(),
  mount: {
    _tag: "PositionExit",
    balanceId: "balance",
    integrationId: "integration",
  },
});

const openEnterSession = () =>
  makeClassicFlowSession(enterStart(), walletScope);

const idleWorkflow = (
  input: TransactionWorkflowInput
): TransactionWorkflowHandle => ({
  dispatch: () => Effect.void,
  states: Stream.succeed(initializeTransactionWorkflow(input)),
});

type KitOverrides = Readonly<{
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly walletState?: WalletState;
}>;

const makeKit = (overrides: KitOverrides = {}) =>
  makeClassicFlowTestKit({
    initialWalletState:
      overrides.walletState ?? makeConnectedWalletState(walletScope),
    makeWorkflow:
      overrides.makeWorkflow ??
      ((input) => Effect.succeed(idleWorkflow(input))),
    navigation: overrides.execute ? { execute: overrides.execute } : {},
    ...(overrides.previewAction
      ? { previewAction: overrides.previewAction }
      : {}),
  });

// Start's Review navigation carries the Session as state; flow assertions
// compare routes only.
const withoutNavigationState = (
  commands: ReadonlyArray<WidgetNavigationCommand>
) => commands.map(({ state: _state, ...command }) => command);

const unavailablePreview = () =>
  Effect.fail(
    new ApiRequestError({
      cause: new Error("temporarily unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "previewAction",
    })
  );

const handOffAction = (session: ClassicFlowSession, action: YieldAction) =>
  handOffClassicFlowSource(session, { _tag: "Action", action });

// The handoff Review created; Steps learns it from its navigation state.
const heldHandoff = (session: ClassicFlowSession) =>
  Ref.get(session.handoff).pipe(
    Effect.flatMap((held) =>
      held ? Effect.succeed(held.handoff) : Effect.die("Expected a handoff")
    )
  );

describe("makeStartClassicTransactionFlow", () => {
  it.effect(
    "navigates to Review carrying a fresh Flow Session with a copied intake",
    () =>
      Effect.gen(function* () {
        const kit = yield* makeKit({
          walletState: makeConnectingWalletState(walletScope),
        });
        const start = yield* makeStartClassicTransactionFlow.pipe(
          Effect.provide(kit.layer)
        );
        const input = enterStart();

        const first = yield* start(input);
        const second = yield* start(input);

        if (first._tag !== "Started" || second._tag !== "Started") {
          throw new Error("Expected started Classic Flow Sessions");
        }
        expect(first.session).not.toBe(second.session);
        expect(second.session.intake).toEqual(input.intake);
        expect(second.session.intake).not.toBe(input.intake);
        expect(second.session.intake.walletScope).toEqual(walletScope);
        expect(second.session.intake.walletScope).not.toBe(
          input.intake.walletScope
        );
        expect(second.session.destination).toEqual({
          completePath: toWidgetPath("/complete"),
          reviewPath: toWidgetPath("/review"),
          stepsPath: toWidgetPath("/steps"),
        });
        expect(
          (yield* kit.navigation.commands).map((command) => ({
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
            session: first.session,
          },
          {
            _tag: "Push",
            path: toWidgetPath("/review"),
            session: second.session,
          },
        ]);
      })
  );

  it.effect("fails Start when its Review navigation fails", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        execute: () =>
          Effect.fail(new WidgetNavigationError({ cause: "blocked" })),
      });
      const start = yield* makeStartClassicTransactionFlow.pipe(
        Effect.provide(kit.layer)
      );

      const error = yield* Effect.flip(start(enterStart()));

      expect(error).toMatchObject({ _tag: "WidgetNavigationError" });
      expect(withoutNavigationState(yield* kit.navigation.commands)).toEqual([
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
        const kit = yield* makeKit({
          execute: () =>
            Deferred.succeed(navigationStarted, undefined).pipe(
              Effect.andThen(Deferred.await(navigationRelease)),
              Effect.andThen(
                Effect.sync(() => {
                  navigated.push("review");
                })
              )
            ),
        });
        const start = yield* makeStartClassicTransactionFlow.pipe(
          Effect.provide(kit.layer)
        );

        const started = yield* start(enterStart()).pipe(
          Effect.forkChild({ startImmediately: true })
        );
        yield* Deferred.await(navigationStarted);
        const interrupt = yield* Fiber.interrupt(started).pipe(
          Effect.forkChild({ startImmediately: true })
        );
        yield* Effect.yieldNow;
        const interruptedBeforeNavigation = interrupt.pollUnsafe();
        yield* Deferred.succeed(navigationRelease, undefined);
        yield* Fiber.join(interrupt);

        expect(interruptedBeforeNavigation).toBeUndefined();
        expect(navigated).toEqual(["review"]);
      })
  );

  it.effect("rejects a Start for a non-owning Wallet without navigating", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        walletState: makeConnectedWalletState(otherWalletScope),
      });
      const start = yield* makeStartClassicTransactionFlow.pipe(
        Effect.provide(kit.layer)
      );

      expect(yield* start(enterStart())).toEqual({ _tag: "RejectedOwner" });
      expect(yield* kit.navigation.commands).toEqual([]);
    })
  );
});

describe("previewClassicFlowAction", () => {
  it.effect(
    "returns the continued Activity action without previewing another",
    () =>
      Effect.gen(function* () {
        const intake = makeContinuationIntake();
        const previewAction = vi.fn(() => Effect.die("unexpected preview"));
        const kit = yield* makeKit({ previewAction });

        const action = yield* previewClassicFlowAction(intake).pipe(
          Effect.provide(kit.layer)
        );

        expect(action).toBe(intake.action);
        expect(previewAction).not.toHaveBeenCalled();
      })
  );

  for (const { intent, makeIntake, status } of [
    { intent: "enter", makeIntake: makeEnterIntake, status: "BLOCKED" },
    { intent: "exit", makeIntake: makeExitIntake, status: "FAILED" },
    { intent: "manage", makeIntake: makeManageIntake, status: "FAILED" },
  ] as const) {
    it.effect(`rejects an ${intent} preview with a ${status} transaction`, () =>
      Effect.gen(function* () {
        const intake = makeIntake();
        const previewAction = vi.fn<
          YieldOperations["Service"]["previewAction"]
        >(() =>
          Effect.succeed(
            yieldApiActionFixture({
              transactions: [
                yieldApiTransactionFixture({
                  id: "invalid-transaction",
                  status,
                }),
              ],
            })
          )
        );
        const kit = yield* makeKit({ previewAction });

        const error = yield* Effect.flip(
          previewClassicFlowAction(intake).pipe(Effect.provide(kit.layer))
        );

        expect(error).toMatchObject({
          _tag: "ClassicFlowInvalidPreviewError",
          retryable: false,
        });
        expect(previewAction).toHaveBeenCalledExactlyOnceWith({
          command: intake.request,
          intent,
        });
      })
    );
  }

  it.effect(
    "removes skipped transactions and preserves pending transactions",
    () =>
      Effect.gen(function* () {
        const executableTransaction = yieldApiTransactionFixture({
          id: "executable-transaction",
          status: "PENDING",
        });
        const kit = yield* makeKit({
          previewAction: () =>
            Effect.succeed(
              yieldApiActionFixture({
                transactions: [
                  yieldApiTransactionFixture({
                    id: "skipped-transaction",
                    status: "SKIPPED",
                  }),
                  executableTransaction,
                ],
              })
            ),
        });

        const action = yield* previewClassicFlowAction(makeEnterIntake()).pipe(
          Effect.provide(kit.layer)
        );

        expect(action?.transactions).toMatchObject([
          { id: executableTransaction.id, status: "PENDING" },
        ]);
      })
  );

  it.effect("keeps an all-skipped preview without transactions", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        previewAction: () =>
          Effect.succeed(
            yieldApiActionFixture({
              transactions: [
                yieldApiTransactionFixture({
                  id: "skipped-transaction",
                  status: "SKIPPED",
                }),
              ],
            })
          ),
      });

      const action = yield* previewClassicFlowAction(makeEnterIntake()).pipe(
        Effect.provide(kit.layer)
      );

      expect(action?.transactions).toEqual([]);
    })
  );

  it.effect("fails an invalid preview request as not retryable", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        previewAction: () =>
          Effect.fail(
            new InputValidationError({
              cause: new Error("invalid amount"),
              issue: "amount must be a decimal string",
              operation: "previewAction",
            })
          ),
      });

      const error = yield* Effect.flip(
        previewClassicFlowAction(makeEnterIntake()).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({
        _tag: "ClassicFlowInvalidPreviewRequestError",
        retryable: false,
      });
    })
  );

  it.effect("fails an unavailable preview as retryable", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({ previewAction: unavailablePreview });

      const error = yield* Effect.flip(
        previewClassicFlowAction(makeEnterIntake()).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({
        _tag: "ClassicFlowPreviewError",
        retryable: true,
      });
    })
  );
});

describe("handOffClassicFlowSource", () => {
  it.effect("holds the action and navigates to Steps", () =>
    Effect.gen(function* () {
      const action = yieldApiActionFixture();
      const handle = openEnterSession();
      const kit = yield* makeKit();

      const outcome = yield* handOffAction(handle, action).pipe(
        Effect.provide(kit.layer)
      );
      const handoff = yield* heldHandoff(handle);

      expect(outcome).toEqual({ _tag: "Confirmed" });
      expect(handoff.source).toEqual({ _tag: "Action", action });
      expect(yield* Ref.get(handle.handoff)).toEqual({
        _tag: "Waiting",
        handoff,
      });
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          path: toWidgetPath("/steps"),
          state: makeClassicFlowNavigationState(handle, handoff),
        },
      ]);
      expect(
        decodeClassicFlowExecutionHandoff(
          (yield* kit.navigation.commands)[0]?.state
        )
      ).toBe(handoff);
      expect(yield* kit.tracking.trackedEvents).toEqual([]);
    })
  );

  it.effect("tracks an Exit confirmation as unstakeClicked", () =>
    Effect.gen(function* () {
      const start = exitStart();
      const handle = makeClassicFlowSession(start, walletScope);
      const action = yieldApiActionFixture();
      const kit = yield* makeKit();

      const outcome = yield* handOffAction(handle, action).pipe(
        Effect.provide(kit.layer)
      );
      const handoff = yield* heldHandoff(handle);

      expect(outcome).toEqual({ _tag: "Confirmed" });
      expect(yield* kit.tracking.trackedEvents).toEqual([
        {
          event: "unstakeClicked",
          properties: {
            amount: "1",
            yieldId:
              start.intake._tag === "Exit" ? start.intake.integration.id : null,
          },
        },
      ]);
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          path: toWidgetPath("/positions/integration/balance/unstake/steps"),
          state: makeClassicFlowNavigationState(handle, handoff),
        },
      ]);
    })
  );

  it.effect(
    "rejects another confirmation while the handed-off action waits",
    () =>
      Effect.gen(function* () {
        const first = yieldApiActionFixture({ id: "first" });
        const handle = openEnterSession();
        const kit = yield* makeKit();

        const confirmed = yield* handOffAction(handle, first).pipe(
          Effect.provide(kit.layer)
        );
        const handoff = yield* heldHandoff(handle);
        const duplicate = yield* handOffAction(
          handle,
          yieldApiActionFixture({ id: "second" })
        ).pipe(Effect.provide(kit.layer));

        expect(confirmed).toEqual({ _tag: "Confirmed" });
        expect(duplicate).toEqual({ _tag: "RejectedConfirmed" });
        const held = yield* Ref.get(handle.handoff);
        expect(held?._tag).toBe("Waiting");
        expect(held?.handoff).toBe(handoff);
        expect(held?.handoff.source).toEqual({ _tag: "Action", action: first });
        expect(yield* kit.navigation.commands).toHaveLength(1);
      })
  );

  it.effect("hands off again after Steps navigation failed", () =>
    Effect.gen(function* () {
      const handle = openEnterSession();
      const kit = yield* makeKit({
        execute: vi
          .fn<WidgetNavigation["Service"]["execute"]>(() => Effect.void)
          .mockReturnValueOnce(
            Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
          ),
      });
      const second = yieldApiActionFixture({ id: "second" });

      const failed = yield* Effect.flip(
        handOffAction(handle, yieldApiActionFixture({ id: "first" })).pipe(
          Effect.provide(kit.layer)
        )
      );
      const retried = yield* handOffAction(handle, second).pipe(
        Effect.provide(kit.layer)
      );

      expect(failed).toMatchObject({ _tag: "WidgetNavigationError" });
      expect(retried).toEqual({ _tag: "Confirmed" });
      expect((yield* heldHandoff(handle)).source).toEqual({
        _tag: "Action",
        action: second,
      });
    })
  );

  it.effect(
    "lets an interrupted handoff finish its Steps navigation and keep the action",
    () =>
      Effect.gen(function* () {
        const stepsStarted = yield* Deferred.make<void>();
        const stepsRelease = yield* Deferred.make<void>();
        const action = yieldApiActionFixture();
        const handle = openEnterSession();
        const kit = yield* makeKit({
          execute: () =>
            Deferred.succeed(stepsStarted, undefined).pipe(
              Effect.andThen(Deferred.await(stepsRelease))
            ),
        });

        const handOff = yield* handOffAction(handle, action).pipe(
          Effect.provide(kit.layer),
          Effect.forkChild({ startImmediately: true })
        );
        yield* Deferred.await(stepsStarted);
        const interrupt = yield* Fiber.interrupt(handOff).pipe(
          Effect.forkChild({ startImmediately: true })
        );
        yield* Effect.yieldNow;
        const interruptedWhileNavigating = interrupt.pollUnsafe();
        yield* Deferred.succeed(stepsRelease, undefined);
        yield* Fiber.join(interrupt);

        expect(interruptedWhileNavigating).toBeUndefined();
        const held = yield* Ref.get(handle.handoff);
        expect(held?._tag).toBe("Waiting");
        expect(held?.handoff.source).toEqual({ _tag: "Action", action });
      })
  );
});

describe("startClassicFlowExecution", () => {
  it.effect(
    "starts the handed-off action once, so a later Execution is interrupted",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({ id: "confirmed-action" });
        const handle = openEnterSession();
        const makeWorkflow = vi.fn<
          TransactionWorkflowService["Service"]["make"]
        >((input) => Effect.succeed(idleWorkflow(input)));
        const kit = yield* makeKit({ makeWorkflow });
        yield* handOffAction(handle, action).pipe(Effect.provide(kit.layer));
        const handoff = yield* heldHandoff(handle);

        const first = yield* Effect.exit(
          Effect.scoped(startClassicFlowExecution(handle, handoff)).pipe(
            Effect.provide(kit.layer)
          )
        );
        const second = yield* Effect.exit(
          Effect.scoped(startClassicFlowExecution(handle, handoff)).pipe(
            Effect.provide(kit.layer)
          )
        );

        expect(Exit.isSuccess(first)).toBe(true);
        expect(Exit.hasInterrupts(second)).toBe(true);
        expect(makeWorkflow).toHaveBeenCalledTimes(1);
        expect(makeWorkflow.mock.calls[0]?.[0]).toMatchObject({
          _tag: "Classic",
          actionMeta: { actionId: action.id },
        });
        expect(yield* Ref.get(handle.handoff)).toBeNull();
      })
  );

  it.effect("interrupts an Execution started before any handoff", () =>
    Effect.gen(function* () {
      const makeWorkflow = vi.fn<TransactionWorkflowService["Service"]["make"]>(
        () => Effect.die("unexpected workflow")
      );
      const kit = yield* makeKit({ makeWorkflow });

      const exit = yield* Effect.exit(
        Effect.scoped(
          startClassicFlowExecution(
            openEnterSession(),
            new ClassicFlowHandoff({
              _tag: "Action",
              action: yieldApiActionFixture(),
            })
          )
        ).pipe(Effect.provide(kit.layer))
      );

      expect(Exit.hasInterrupts(exit)).toBe(true);
      expect(makeWorkflow).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "does not take a later handoff of the same continued action for an earlier one",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({
          id: "waiting-action",
          status: "WAITING_FOR_NEXT",
        });
        const handle = makeYieldActionContinuationSession(
          makeContinuationIntake(action)
        );
        const makeWorkflow = vi.fn<
          TransactionWorkflowService["Service"]["make"]
        >((input) => Effect.succeed(idleWorkflow(input)));
        const kit = yield* makeKit({ makeWorkflow });
        yield* handOffAction(handle, action).pipe(Effect.provide(kit.layer));
        const earlier = yield* heldHandoff(handle);
        // Review's arrival releases a handoff Steps never started.
        yield* Ref.set(handle.handoff, null);
        yield* handOffAction(handle, action).pipe(Effect.provide(kit.layer));
        const later = yield* heldHandoff(handle);

        const exit = yield* Effect.exit(
          Effect.scoped(startClassicFlowExecution(handle, earlier)).pipe(
            Effect.provide(kit.layer)
          )
        );

        expect(later).not.toBe(earlier);
        expect(later.source).toEqual(earlier.source);
        expect(Exit.hasInterrupts(exit)).toBe(true);
        expect(makeWorkflow).not.toHaveBeenCalled();
        const held = yield* Ref.get(handle.handoff);
        expect(held?._tag).toBe("Waiting");
        expect(held?.handoff).toBe(later);
      })
  );

  it.effect("starts a continued Activity action's workflow", () =>
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
      const handle = makeYieldActionContinuationSession(
        makeContinuationIntake(action)
      );
      const inputs: Array<TransactionWorkflowInput> = [];
      const kit = yield* makeKit({
        makeWorkflow: (input) =>
          Effect.sync(() => {
            inputs.push(input);
            return idleWorkflow(input);
          }),
      });

      const continued = yield* previewClassicFlowAction(handle.intake).pipe(
        Effect.provide(kit.layer)
      );
      if (!continued) return yield* Effect.die("Expected the continued action");
      yield* handOffAction(handle, continued).pipe(Effect.provide(kit.layer));
      const handoff = yield* heldHandoff(handle);
      yield* Effect.scoped(startClassicFlowExecution(handle, handoff)).pipe(
        Effect.provide(kit.layer)
      );

      expect(inputs).toMatchObject([
        {
          _tag: "Classic",
          actionMeta: { actionId: action.id },
          transactions: [{ id: "waiting-transaction" }],
        },
      ]);
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          path: toWidgetPath(`/activity/${action.id}/steps`),
          state: makeClassicFlowNavigationState(handle, handoff),
        },
      ]);
    })
  );

  it.effect("fails when the workflow input is invalid", () =>
    Effect.gen(function* () {
      const handle = openEnterSession();
      const kit = yield* makeKit({
        makeWorkflow: () =>
          Effect.fail(
            new TransactionWorkflowInputError({
              message: "invalid workflow input",
              workflowId: TransactionWorkflowId.make("workflow"),
            })
          ),
      });
      yield* handOffAction(handle, yieldApiActionFixture()).pipe(
        Effect.provide(kit.layer)
      );
      const handoff = yield* heldHandoff(handle);

      const error = yield* Effect.flip(
        Effect.scoped(startClassicFlowExecution(handle, handoff)).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({ _tag: "TransactionWorkflowInputError" });
    })
  );

  it.effect("ends the workflow when the caller's Scope closes", () =>
    Effect.gen(function* () {
      let workflowsClosed = 0;
      const handle = openEnterSession();
      const kit = yield* makeKit({
        makeWorkflow: (input) =>
          Effect.addFinalizer(() =>
            Effect.sync(() => {
              workflowsClosed += 1;
            })
          ).pipe(Effect.as(idleWorkflow(input))),
      });
      yield* handOffAction(handle, yieldApiActionFixture()).pipe(
        Effect.provide(kit.layer)
      );
      const handoff = yield* heldHandoff(handle);

      const executionScope = yield* Scope.make();
      yield* startClassicFlowExecution(handle, handoff).pipe(
        Scope.provide(executionScope),
        Effect.provide(kit.layer)
      );
      const closedWhileOpen = workflowsClosed;
      yield* Scope.close(executionScope, Exit.void);

      expect({ closedAfterClose: workflowsClosed, closedWhileOpen }).toEqual({
        closedAfterClose: 1,
        closedWhileOpen: 0,
      });
    })
  );

  it.effect(
    "holds the action while its Execution runs, so another handoff is rejected",
    () =>
      Effect.gen(function* () {
        const handle = openEnterSession();
        const kit = yield* makeKit();
        const action = yieldApiActionFixture({ id: "running-action" });
        yield* handOffAction(handle, action).pipe(Effect.provide(kit.layer));
        const handoff = yield* heldHandoff(handle);
        const executionScope = yield* Scope.make();
        yield* startClassicFlowExecution(handle, handoff).pipe(
          Scope.provide(executionScope),
          Effect.provide(kit.layer)
        );

        // Review stays interactive until Steps commits.
        const whileRunning = yield* handOffAction(handle, action).pipe(
          Effect.provide(kit.layer)
        );
        const heldWhileRunning = yield* Ref.get(handle.handoff);
        yield* Scope.close(executionScope, Exit.void);

        expect(whileRunning).toEqual({ _tag: "RejectedConfirmed" });
        expect(yield* kit.navigation.commands).toHaveLength(1);
        expect(heldWhileRunning?._tag).toBe("Running");
        expect(heldWhileRunning?.handoff).toBe(handoff);
        expect(yield* Ref.get(handle.handoff)).toBeNull();
      })
  );
});

describe("leaveClassicFlowExecution", () => {
  const leave = (session: ClassicFlowSession, to: "Exit" | "Review") =>
    Effect.gen(function* () {
      const kit = yield* makeKit();
      yield* leaveClassicFlowExecution(session, to).pipe(
        Effect.provide(kit.layer)
      );
      return yield* kit.navigation.commands;
    });

  it.effect("replaces Steps with Review when going back", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(
          makeClassicFlowSession(enterStart(), walletScope),
          "Review"
        )
      ).toEqual([{ _tag: "Replace", path: toWidgetPath("/review") }]);
    })
  );

  it.effect("leaves a finished flow for Earn", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(makeClassicFlowSession(enterStart(), walletScope), "Exit")
      ).toEqual([{ _tag: "Push", path: toWidgetPath("/") }]);
    })
  );

  it.effect("leaves a finished continuation for Activity", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(
          makeYieldActionContinuationSession(makeContinuationIntake()),
          "Exit"
        )
      ).toEqual([{ _tag: "Push", path: toWidgetPath("/activity") }]);
    })
  );

  it.effect("lets an interrupted Back navigation finish first", () =>
    Effect.gen(function* () {
      const backStarted = yield* Deferred.make<void>();
      const backRelease = yield* Deferred.make<void>();
      const kit = yield* makeKit({
        execute: () =>
          Deferred.succeed(backStarted, undefined).pipe(
            Effect.andThen(Deferred.await(backRelease))
          ),
      });

      const back = yield* leaveClassicFlowExecution(
        makeClassicFlowSession(enterStart(), walletScope),
        "Review"
      ).pipe(
        Effect.provide(kit.layer),
        Effect.forkChild({ startImmediately: true })
      );
      yield* Deferred.await(backStarted);
      const interrupt = yield* Fiber.interrupt(back).pipe(
        Effect.forkChild({ startImmediately: true })
      );
      yield* Effect.yieldNow;
      const interruptedWhileBackPending = interrupt.pollUnsafe();
      yield* Deferred.succeed(backRelease, undefined);
      yield* Fiber.join(interrupt);

      expect(interruptedWhileBackPending).toBeUndefined();
      expect(yield* kit.navigation.commands).toEqual([
        { _tag: "Replace", path: toWidgetPath("/review") },
      ]);
    })
  );
});
