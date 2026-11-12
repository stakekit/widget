import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import {
  DateTime,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Ref,
  Schema,
  Scope,
  Stream,
} from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import type { YieldAction } from "../../../src/domain/earn/action-models";
import { EarnValidator } from "../../../src/domain/earn/validator";
import {
  TransactionWorkflowId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  getYieldFlowExitUnlockDate,
  getYieldFlowPositionBalanceId,
} from "../../../src/features/yield-transaction-flow/model/completion";
import type { YieldTransactionFlowIntake } from "../../../src/features/yield-transaction-flow/model/intake";
import {
  getYieldFlowRouteGroup,
  makeYieldActionContinuationSession,
  makeYieldFlowSession,
  type NavigatingYieldTransactionFlowStart,
  YieldFlowHandoff,
  type YieldFlowSession,
  yieldFlowRoutes,
} from "../../../src/features/yield-transaction-flow/model/session";
import {
  leaveYieldFlowExecution,
  startYieldFlowExecution,
} from "../../../src/features/yield-transaction-flow/state/execution-page";
import {
  handOffYieldFlowSource,
  previewYieldFlowAction,
} from "../../../src/features/yield-transaction-flow/state/review-page";
import { makeStartYieldTransactionFlow } from "../../../src/features/yield-transaction-flow/state/start-flow";
import type { YieldOperations } from "../../../src/services/api/operations";
import {
  ApiRequestError,
  InputValidationError,
} from "../../../src/services/api/resource-sources";
import {
  type WidgetNavigation,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../../src/services/navigation/widget-navigation";
import {
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
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
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
} from "../../fixtures/wallet-state";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const integrationId = Schema.decodeSync(YieldId)("integration");
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x2234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});

const makeEnterIntake = (): Extract<
  YieldTransactionFlowIntake,
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
  YieldTransactionFlowIntake,
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
  YieldTransactionFlowIntake,
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
  YieldTransactionFlowIntake,
  { readonly _tag: "Manage" }
> => {
  const integration = yieldApiYieldFixture();

  return {
    _tag: "Manage",
    amount: null,
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

const enterStart = (): NavigatingYieldTransactionFlowStart => ({
  intake: makeEnterIntake(),
  mount: { _tag: "Earn" },
});

const exitStart = (): NavigatingYieldTransactionFlowStart => ({
  intake: makeExitIntake(),
  mount: {
    _tag: "PositionExit",
    balanceId: "default",
    integrationId,
  },
});

const openEnterSession = () => makeYieldFlowSession(enterStart(), walletScope);

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
  makeYieldFlowTestKit({
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
) =>
  commands.map((command) =>
    command._tag === "Back"
      ? command
      : { ...command, to: widgetTargetPath(command.to) }
  );

const unavailablePreview = () =>
  Effect.fail(
    new ApiRequestError({
      cause: new Error("temporarily unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "previewAction",
    })
  );

const handOffAction = (session: YieldFlowSession, action: YieldAction) =>
  handOffYieldFlowSource(session, { _tag: "Action", action });

// The handoff Review created; Steps learns it from its navigation state.
const heldHandoff = (session: YieldFlowSession) =>
  Ref.get(session.handoff).pipe(
    Effect.flatMap((held) =>
      held ? Effect.succeed(held.handoff) : Effect.die("Expected a handoff")
    )
  );

describe("makeStartYieldTransactionFlow", () => {
  it.effect(
    "navigates to Review carrying a fresh Flow Session with a copied intake",
    () =>
      Effect.gen(function* () {
        const kit = yield* makeKit({
          walletState: makeConnectingWalletState(walletScope),
        });
        const start = yield* makeStartYieldTransactionFlow.pipe(
          Effect.provide(kit.layer)
        );
        const input = enterStart();

        const first = yield* start(input);
        const second = yield* start(input);

        if (first._tag !== "Started" || second._tag !== "Started") {
          throw new Error("Expected started Yield Flow Sessions");
        }
        expect(first.session).not.toBe(second.session);
        expect(second.session.intake).toEqual(input.intake);
        expect(second.session.intake).not.toBe(input.intake);
        expect(second.session.intake.walletScope).toEqual(walletScope);
        expect(second.session.intake.walletScope).not.toBe(
          input.intake.walletScope
        );
        expect(second.session.destination).toMatchObject({
          completePath: "/complete",
          finishPath: "/",
          reviewPath: "/review",
          stepsPath: "/steps",
        });
        expect(
          (yield* kit.navigation.commands).map((command) => ({
            _tag: command._tag,
            path: command._tag === "Back" ? null : widgetTargetPath(command.to),
            session: Option.getOrNull(
              yieldFlowRoutes.Earn.state(
                command._tag === "Back" ? null : widgetTargetState(command.to)
              ).pipe(Option.map((state) => state.yieldFlowSession))
            ),
          }))
        ).toEqual([
          {
            _tag: "Push",
            path: "/review",
            session: first.session,
          },
          {
            _tag: "Push",
            path: "/review",
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
      const start = yield* makeStartYieldTransactionFlow.pipe(
        Effect.provide(kit.layer)
      );

      const error = yield* Effect.flip(start(enterStart()));

      expect(error).toMatchObject({ _tag: "WidgetNavigationError" });
      expect(withoutNavigationState(yield* kit.navigation.commands)).toEqual([
        { _tag: "Push", to: "/review" },
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
        const start = yield* makeStartYieldTransactionFlow.pipe(
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
      const start = yield* makeStartYieldTransactionFlow.pipe(
        Effect.provide(kit.layer)
      );

      expect(yield* start(enterStart())).toEqual({ _tag: "RejectedOwner" });
      expect(yield* kit.navigation.commands).toEqual([]);
    })
  );
});

describe("previewYieldFlowAction", () => {
  it.effect(
    "returns the continued Activity action without previewing another",
    () =>
      Effect.gen(function* () {
        const intake = makeContinuationIntake();
        const previewAction = vi.fn(() => Effect.die("unexpected preview"));
        const kit = yield* makeKit({ previewAction });

        const action = yield* previewYieldFlowAction(intake).pipe(
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
          previewYieldFlowAction(intake).pipe(Effect.provide(kit.layer))
        );

        expect(error).toMatchObject({
          _tag: "YieldFlowInvalidPreviewError",
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

        const action = yield* previewYieldFlowAction(makeEnterIntake()).pipe(
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

      const action = yield* previewYieldFlowAction(makeEnterIntake()).pipe(
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
        previewYieldFlowAction(makeEnterIntake()).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({
        _tag: "YieldFlowInvalidPreviewRequestError",
        retryable: false,
      });
    })
  );

  it.effect("fails an unavailable preview as retryable", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({ previewAction: unavailablePreview });

      const error = yield* Effect.flip(
        previewYieldFlowAction(makeEnterIntake()).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({
        _tag: "YieldFlowPreviewError",
        retryable: true,
      });
    })
  );
});

describe("handOffYieldFlowSource", () => {
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
          to: {
            path: "/steps",
            state: { executionHandoff: handoff, yieldFlowSession: handle },
          },
        },
      ]);
      const [command] = yield* kit.navigation.commands;
      expect(
        Option.getOrNull(
          yieldFlowRoutes.Earn.state(
            command && command._tag !== "Back"
              ? widgetTargetState(command.to)
              : null
          ).pipe(
            Option.flatMap((state) =>
              Option.fromUndefinedOr(state.executionHandoff)
            )
          )
        )
      ).toBe(handoff);
      expect(yield* kit.tracking.trackedEvents).toEqual([]);
    })
  );

  it.effect("tracks an Exit confirmation as unstakeClicked", () =>
    Effect.gen(function* () {
      const start = exitStart();
      const handle = makeYieldFlowSession(start, walletScope);
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
          to: {
            path: "/positions/integration/default/unstake/steps",
            state: { executionHandoff: handoff, yieldFlowSession: handle },
          },
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

describe("startYieldFlowExecution", () => {
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
          Effect.scoped(startYieldFlowExecution(handle, handoff)).pipe(
            Effect.provide(kit.layer)
          )
        );
        const second = yield* Effect.exit(
          Effect.scoped(startYieldFlowExecution(handle, handoff)).pipe(
            Effect.provide(kit.layer)
          )
        );

        expect(Exit.isSuccess(first)).toBe(true);
        expect(Exit.hasInterrupts(second)).toBe(true);
        expect(makeWorkflow).toHaveBeenCalledTimes(1);
        expect(makeWorkflow.mock.calls[0]?.[0]).toMatchObject({
          _tag: "Yield",
          actionMeta: { actionId: action.id },
        });
        expect(yield* Ref.get(handle.handoff)).toBeNull();
      })
  );

  // Steps first reads the Atom that starts its workflow while React renders,
  // and the Atom runtime runs what that read forks before it returns. The
  // workflow's first wallet request and lifecycle event must not land there.
  it.effect("makes no workflow in the Atom read that starts it", () =>
    Effect.gen(function* () {
      const handle = openEnterSession();
      const makeWorkflow = vi.fn<TransactionWorkflowService["Service"]["make"]>(
        (input) => Effect.succeed(idleWorkflow(input))
      );
      const kit = yield* makeKit({ makeWorkflow });
      yield* handOffAction(handle, yieldApiActionFixture()).pipe(
        Effect.provide(kit.layer)
      );
      const handoff = yield* heldHandoff(handle);
      // Built up front, so the read cannot wait on the layer instead.
      const services = yield* Layer.build(kit.layer);
      const executionAtom = Atom.runtime(Layer.succeedContext(services)).atom(
        startYieldFlowExecution(handle, handoff)
      );
      const registry = AtomRegistry.make();
      const unmount = registry.mount(executionAtom);

      registry.get(executionAtom);

      expect(makeWorkflow).not.toHaveBeenCalled();
      yield* Effect.promise(() =>
        vi.waitFor(() => expect(makeWorkflow).toHaveBeenCalledOnce())
      );
      unmount();
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
          startYieldFlowExecution(
            openEnterSession(),
            new YieldFlowHandoff({
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
          Effect.scoped(startYieldFlowExecution(handle, earlier)).pipe(
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

      const continued = yield* previewYieldFlowAction(handle.intake).pipe(
        Effect.provide(kit.layer)
      );
      if (!continued) return yield* Effect.die("Expected the continued action");
      yield* handOffAction(handle, continued).pipe(Effect.provide(kit.layer));
      const handoff = yield* heldHandoff(handle);
      yield* Effect.scoped(startYieldFlowExecution(handle, handoff)).pipe(
        Effect.provide(kit.layer)
      );

      expect(inputs).toMatchObject([
        {
          _tag: "Yield",
          actionMeta: { actionId: action.id },
          transactions: [{ id: "waiting-transaction" }],
        },
      ]);
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          to: {
            path: `/activity/${action.id}/steps`,
            state: { executionHandoff: handoff, yieldFlowSession: handle },
          },
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
        Effect.scoped(startYieldFlowExecution(handle, handoff)).pipe(
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
      yield* startYieldFlowExecution(handle, handoff).pipe(
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
        yield* startYieldFlowExecution(handle, handoff).pipe(
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

describe("leaveYieldFlowExecution", () => {
  const leave = (session: YieldFlowSession, to: "Exit" | "Review") =>
    Effect.gen(function* () {
      const kit = yield* makeKit();
      yield* leaveYieldFlowExecution(session, to).pipe(
        Effect.provide(kit.layer)
      );
      return yield* kit.navigation.commands;
    });

  it.effect("goes back to Review's own history entry", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(makeYieldFlowSession(enterStart(), walletScope), "Review")
      ).toEqual([{ _tag: "Back" }]);
    })
  );

  // Back through Review and Steps, then the finish page in place of the page
  // the flow started from, so Back from there never lands on Review again.
  const leftFor = (to: string) => [
    { _tag: "Back", steps: 2 },
    { _tag: "Replace", to },
  ];

  it.effect("leaves a finished flow for Earn, out of its history", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(makeYieldFlowSession(enterStart(), walletScope), "Exit")
      ).toEqual(leftFor("/"));
    })
  );

  it.effect.each([
    ["exit", exitStart],
    [
      "pending action",
      (): NavigatingYieldTransactionFlowStart => ({
        intake: makeManageIntake(),
        mount: {
          _tag: "PositionManage",
          balanceId: "default",
          integrationId,
        },
      }),
    ],
    [
      "position stake",
      (): NavigatingYieldTransactionFlowStart => ({
        intake: makeEnterIntake(),
        mount: {
          _tag: "PositionStake",
          balanceId: "default",
          integrationId,
        },
      }),
    ],
  ] as const)("leaves a finished %s flow for the position", ([, start]) =>
    Effect.gen(function* () {
      expect(
        yield* leave(makeYieldFlowSession(start(), walletScope), "Exit")
      ).toEqual(leftFor("/positions/integration/default"));
    })
  );

  it.effect("leaves a finished continuation for Activity", () =>
    Effect.gen(function* () {
      expect(
        yield* leave(
          makeYieldActionContinuationSession(makeContinuationIntake()),
          "Exit"
        )
      ).toEqual(leftFor("/activity"));
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

      const back = yield* leaveYieldFlowExecution(
        makeYieldFlowSession(enterStart(), walletScope),
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
      expect(yield* kit.navigation.commands).toEqual([{ _tag: "Back" }]);
    })
  );
});

const makeValidator = (address: string) =>
  Schema.decodeSync(EarnValidator)(yieldApiValidatorFixture({ address }));

describe("getYieldFlowPositionBalanceId", () => {
  it("leads an Earn flow to the yield's default balance", () => {
    expect(
      getYieldFlowPositionBalanceId(
        makeYieldFlowSession(enterStart(), walletScope),
        ["validators", "default"]
      )
    ).toBe("default");
  });

  it("leads an Earn flow to the yield's only balance", () => {
    expect(
      getYieldFlowPositionBalanceId(
        makeYieldFlowSession(enterStart(), walletScope),
        ["validators"]
      )
    ).toBe("validators");
  });

  it("leads nowhere before the portfolio holds the position", () => {
    expect(
      getYieldFlowPositionBalanceId(
        makeYieldFlowSession(enterStart(), walletScope),
        []
      )
    ).toBeNull();
  });

  it("returns a position page's flow to its own balance while it exists", () => {
    const session = makeYieldFlowSession(exitStart(), walletScope);
    expect(
      getYieldFlowPositionBalanceId(session, ["validators", "default"])
    ).toBe("default");
    expect(getYieldFlowPositionBalanceId(session, ["validators"])).toBeNull();
  });

  it("leads a continued action to the yield's default balance", () => {
    expect(
      getYieldFlowPositionBalanceId(
        makeYieldActionContinuationSession(makeContinuationIntake()),
        ["default"]
      )
    ).toBe("default");
  });

  it("hides the position when only another validator's balance remains", () => {
    const exited = makeValidator("0xexited");
    const remaining = makeValidator("0xremaining");
    const session = makeYieldActionContinuationSession({
      ...makeContinuationIntake(),
      selectedValidators: [exited],
    });

    expect(
      getYieldFlowPositionBalanceId(session, [`validator::${remaining.key}`])
    ).toBeNull();
    expect(
      getYieldFlowPositionBalanceId(session, [`validator::${exited.key}`])
    ).toBe(`validator::${exited.key}`);
  });

  it("leads a flow over several validators to the one balance left among them", () => {
    const first = makeValidator("0xfirst");
    const second = makeValidator("0xsecond");
    const other = makeValidator("0xother");
    const session = makeYieldActionContinuationSession({
      ...makeContinuationIntake(),
      selectedValidators: [first, second],
    });

    expect(
      getYieldFlowPositionBalanceId(session, [
        `validator::${first.key}`,
        `validator::${other.key}`,
      ])
    ).toBe(`validator::${first.key}`);
    expect(
      getYieldFlowPositionBalanceId(session, [`validator::${other.key}`])
    ).toBeNull();
  });
});

describe("getYieldFlowExitUnlockDate", () => {
  const now = DateTime.makeUnsafe("2026-11-05T12:00:00Z");
  const sixHourCooldown = {
    ...yieldApiYieldFixture(),
    mechanics: {
      ...yieldApiYieldFixture().mechanics,
      cooldownPeriod: { seconds: 6 * 3600 },
    },
  };

  it("prefers the API's date for the exiting balance", () => {
    const apiDate = DateTime.makeUnsafe("2026-11-09T08:00:00Z");
    expect(
      getYieldFlowExitUnlockDate({
        balances: [
          {
            date: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
            type: "exiting",
          },
          { date: apiDate, type: "exiting" },
          { date: DateTime.makeUnsafe("2026-12-01T00:00:00Z"), type: "active" },
        ],
        batched: false,
        completedAt: now,
        yieldDto: sixHourCooldown,
      })
    ).toEqual(apiDate);
  });

  it("falls back to the cooldown to the hour", () => {
    expect(
      getYieldFlowExitUnlockDate({
        balances: [],
        batched: false,
        completedAt: now,
        yieldDto: sixHourCooldown,
      })
    ).toEqual(DateTime.makeUnsafe("2026-11-05T18:00:00Z"));
  });

  it("leaves a batched exit or one without a cooldown undated", () => {
    expect(
      getYieldFlowExitUnlockDate({
        balances: [],
        batched: true,
        completedAt: now,
        yieldDto: sixHourCooldown,
      })
    ).toBeNull();
    expect(
      getYieldFlowExitUnlockDate({
        balances: [],
        batched: false,
        completedAt: now,
        yieldDto: yieldApiYieldFixture(),
      })
    ).toBeNull();
  });
});

describe("Yield Flow destination", () => {
  const cases: ReadonlyArray<
    readonly [string, NavigatingYieldTransactionFlowStart, string, string]
  > = [
    ["root Enter", enterStart(), "", "/"],
    [
      "position Stake",
      {
        intake: makeEnterIntake(),
        mount: { _tag: "PositionStake", balanceId: "default", integrationId },
      },
      "/positions/integration/default/stake",
      "/positions/integration/default",
    ],
    [
      "position Exit",
      exitStart(),
      "/positions/integration/default/unstake",
      "/positions/integration/default",
    ],
    [
      "position Manage",
      {
        intake: makeManageIntake(),
        mount: { _tag: "PositionManage", balanceId: "default", integrationId },
      },
      "/positions/integration/default/pending-action",
      "/positions/integration/default",
    ],
  ];

  it.each(cases)(
    "routes a %s flow under its mount and finishes it there",
    (_, start, base, finishPath) => {
      expect(
        makeYieldFlowSession(start, walletScope).destination
      ).toMatchObject({
        completePath: `${base}/complete`,
        finishPath,
        reviewPath: `${base}/review`,
        stepsPath: `${base}/steps`,
      });
    }
  );
});

describe("Yield Flow route group", () => {
  it.each([
    ["/review", "/"],
    ["/steps", "/"],
    ["/complete", "/"],
    ["/complete/", "/"],
    ["/positions/yield/default/stake/review", "/positions/yield/default/stake"],
    ["/positions/yield/default/stake/steps", "/positions/yield/default/stake"],
    [
      "/positions/yield/default/stake/complete/",
      "/positions/yield/default/stake",
    ],
    [
      "/positions/yield/default/unstake/review",
      "/positions/yield/default/unstake",
    ],
    [
      "/positions/yield/default/unstake/complete",
      "/positions/yield/default/unstake",
    ],
    [
      "/positions/yield/default/pending-action/steps",
      "/positions/yield/default/pending-action",
    ],
    [
      "/positions/yield/validators/pending-action/steps",
      "/positions/yield/validators/pending-action",
    ],
    ["/activity/action-1", "/activity/action-1"],
    ["/activity/action-1/", "/activity/action-1"],
    ["/activity/action-1/steps", "/activity/action-1"],
    ["/activity/action-1/complete", "/activity/action-1"],
    ["/activity/action-2/steps", "/activity/action-2"],
  ] as const)("groups %s as %s", (pathname, group) => {
    expect(getYieldFlowRouteGroup(pathname)).toBe(group);
  });

  it.each([
    "/",
    "/positions",
    "/positions/yield/default",
    "/activity",
    "/activity/",
    "/borrow/review",
  ])("does not group %s", (pathname) => {
    expect(getYieldFlowRouteGroup(pathname)).toBeNull();
  });
});
