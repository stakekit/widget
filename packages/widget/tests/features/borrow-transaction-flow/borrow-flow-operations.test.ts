import { describe, expect, it, vi } from "@effect/vitest";
import {
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
import { Action } from "../../../src/domain/borrow/execution/action";
import { Transaction } from "../../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../../src/domain/borrow/ids";
import {
  TransactionWorkflowId,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowIntake,
  decodeBorrowFlowNavigationState,
  makeBorrowFlowNavigationState,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  leaveBorrowFlow,
  startBorrowTransactionFlow,
} from "../../../src/features/borrow-transaction-flow/state/borrow-flow-session";
import { startBorrowFlowExecution } from "../../../src/features/borrow-transaction-flow/state/execution-page";
import { confirmBorrowAction } from "../../../src/features/borrow-transaction-flow/state/review-page";
import { BorrowOperations } from "../../../src/services/api/operations";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
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
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../src/services/transaction-workflow/transaction-workflow-service";
import type { WalletState } from "../../../src/services/wallet/wallet-state";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
} from "../../fixtures/wallet-state";
import { borrowEntryFlowEntry } from "../../utils/borrow-flow-entry";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "base" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000002"
  ),
  network: "base",
});
const marketId = Schema.decodeSync(MarketId)("market-1");

const borrowEntryIntake: BorrowTransactionFlowIntake = {
  riskVerdict: { _tag: "Allow" },
  command: {
    action: "borrow",
    address,
    args: { marketId },
    integrationId: Schema.decodeSync(IntegrationId)("provider-1"),
  },
  entry: borrowEntryFlowEntry,
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

const marketPositionIntake: BorrowTransactionFlowIntake = {
  ...borrowEntryIntake,
  entry: { _tag: "MarketPosition", marketId },
};

const makeAction = (status = "CREATED", id = "action-1"): Action =>
  Schema.decodeUnknownSync(Action)({
    action: "borrow",
    address,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id,
    integrationId: "provider-1",
    rawArguments: borrowEntryIntake.command.args,
    status,
    totalSteps: 1,
    transactions: [
      Schema.encodeSync(Transaction)(
        Schema.decodeSync(Transaction)({
          address,
          chainId: "8453",
          id: "tx-1",
          network: "base",
          signablePayload: "0x00",
          signingFormat: "EVM_TRANSACTION",
          status: "WAITING_FOR_SIGNATURE",
          type: "BORROW",
        })
      ),
    ],
  });

const openSession = (intake = borrowEntryIntake) =>
  new BorrowFlowSession({ intake, walletScope });

const idleWorkflow = (
  input: TransactionWorkflowInput
): TransactionWorkflowHandle => ({
  dispatch: () => Effect.void,
  states: Stream.succeed(initializeTransactionWorkflow(input)),
});

const unexpected = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`borrow flow operations test: unexpected call to ${method}`);

type KitOverrides = Readonly<{
  readonly borrowEnabled?: boolean;
  readonly execute?: WidgetNavigation["Service"]["execute"];
  readonly executeAction?: BorrowOperations["Service"]["executeAction"];
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly walletState?: WalletState;
}>;

const makeKit = Effect.fn("test.makeBorrowFlowKit")(function* (
  overrides: KitOverrides = {}
) {
  const navigation = yield* makeTestNavigation(
    overrides.execute ? { execute: overrides.execute } : {}
  );
  const tracking = yield* makeTestTracking();
  const wallet = yield* makeTestWallet({
    initialState:
      overrides.walletState ?? makeConnectedWalletState(walletScope),
  });
  const layer = Layer.mergeAll(
    WidgetConfigService.layer({
      apiKey: "test-api-key",
      borrowEnabled: overrides.borrowEnabled ?? true,
      dashboardVariant: true,
      variant: "default",
    }),
    navigation.layer,
    tracking.layer,
    wallet.layer,
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction:
          overrides.executeAction ?? (() => Effect.succeed(makeAction())),
        getAction: () => unexpected("BorrowOperations.getAction"),
        stepAction: () => unexpected("BorrowOperations.stepAction"),
        submitTransaction: () =>
          unexpected("BorrowOperations.submitTransaction"),
        submitTransactionInBackground: () =>
          unexpected("BorrowOperations.submitTransactionInBackground"),
      })
    ),
    Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make:
          overrides.makeWorkflow ??
          ((input) => Effect.succeed(idleWorkflow(input))),
      })
    )
  );
  return { layer, navigation, tracking } as const;
});

// Start's Review navigation carries the Session as state; flow assertions
// compare routes only.
const withoutNavigationState = (
  commands: ReadonlyArray<WidgetNavigationCommand>
) => commands.map(({ state: _state, ...command }) => command);

// The action id Steps' navigation state carries after a handoff.
const handedOffActionId = (session: BorrowFlowSession) =>
  Ref.get(session.handoff).pipe(
    Effect.map((handoff) => handoff?.action.id ?? "nothing-handed-off")
  );

describe("startBorrowTransactionFlow", () => {
  it.effect(
    "navigates to Review carrying a fresh Flow Session with a copied intake",
    () =>
      Effect.gen(function* () {
        const kit = yield* makeKit({
          walletState: makeConnectingWalletState(walletScope),
        });

        const first = yield* startBorrowTransactionFlow(borrowEntryIntake).pipe(
          Effect.provide(kit.layer)
        );
        const second = yield* startBorrowTransactionFlow(
          borrowEntryIntake
        ).pipe(Effect.provide(kit.layer));

        if (first._tag !== "Started" || second._tag !== "Started") {
          throw new Error("Expected started Borrow Flow Sessions");
        }
        expect(first.session).not.toBe(second.session);
        expect(second.session.intake).toEqual(borrowEntryIntake);
        expect(second.session.intake).not.toBe(borrowEntryIntake);
        expect(second.session.walletScope).toEqual(walletScope);
        expect(
          (yield* kit.navigation.commands).map((command) => ({
            _tag: command._tag,
            path: command._tag === "Back" ? null : command.path,
            session: Option.getOrNull(
              decodeBorrowFlowNavigationState(command.state)
            ),
          }))
        ).toEqual([
          {
            _tag: "Push",
            path: toWidgetPath("/borrow/review"),
            session: first.session,
          },
          {
            _tag: "Push",
            path: toWidgetPath("/borrow/review"),
            session: second.session,
          },
        ]);
      })
  );

  it.effect("tracks a Borrow Entry Start as borrowReviewClicked", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit();

      const started = yield* startBorrowTransactionFlow(borrowEntryIntake).pipe(
        Effect.provide(kit.layer)
      );

      expect(started._tag).toBe("Started");
      expect(yield* kit.tracking.trackedEvents).toEqual([
        {
          event: "borrowReviewClicked",
          properties: {
            borrowAmount: "1",
            collateralAmount: "0",
            marketId,
          },
        },
      ]);
    })
  );

  it.effect(
    "starts a Market Position flow at its own Review without tracking",
    () =>
      Effect.gen(function* () {
        const kit = yield* makeKit();

        const started = yield* startBorrowTransactionFlow(
          marketPositionIntake
        ).pipe(Effect.provide(kit.layer));

        expect(started._tag).toBe("Started");
        expect(withoutNavigationState(yield* kit.navigation.commands)).toEqual([
          {
            _tag: "Push",
            path: toWidgetPath(`/positions/borrow/${marketId}/review`),
          },
        ]);
        expect(yield* kit.tracking.trackedEvents).toEqual([]);
      })
  );

  it.effect("rejects a Start while Borrow is disabled without navigating", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({ borrowEnabled: false });

      expect(
        yield* startBorrowTransactionFlow(borrowEntryIntake).pipe(
          Effect.provide(kit.layer)
        )
      ).toEqual({ _tag: "RejectedDisabled" });
      expect(yield* kit.navigation.commands).toEqual([]);
      expect(yield* kit.tracking.trackedEvents).toEqual([]);
    })
  );

  it.effect("rejects a Start for a non-owning Wallet without navigating", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        walletState: makeConnectedWalletState(otherWalletScope),
      });

      expect(
        yield* startBorrowTransactionFlow(borrowEntryIntake).pipe(
          Effect.provide(kit.layer)
        )
      ).toEqual({ _tag: "RejectedOwner" });
      expect(yield* kit.navigation.commands).toEqual([]);
      expect(yield* kit.tracking.trackedEvents).toEqual([]);
    })
  );

  it.effect("fails Start when its Review navigation fails", () =>
    Effect.gen(function* () {
      const kit = yield* makeKit({
        execute: () =>
          Effect.fail(new WidgetNavigationError({ cause: "blocked" })),
      });

      const error = yield* Effect.flip(
        startBorrowTransactionFlow(borrowEntryIntake).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({ _tag: "WidgetNavigationError" });
      expect(withoutNavigationState(yield* kit.navigation.commands)).toEqual([
        { _tag: "Push", path: toWidgetPath("/borrow/review") },
      ]);
      expect(yield* kit.tracking.trackedEvents).toEqual([]);
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

        const started = yield* startBorrowTransactionFlow(
          borrowEntryIntake
        ).pipe(
          Effect.provide(kit.layer),
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
});

describe("confirmBorrowAction", () => {
  it.effect("creates the action, hands it off, and navigates to Steps", () =>
    Effect.gen(function* () {
      const action = makeAction();
      const executeAction = vi.fn<BorrowOperations["Service"]["executeAction"]>(
        () => Effect.succeed(action)
      );
      const handle = openSession();
      const kit = yield* makeKit({ executeAction });

      const outcome = yield* confirmBorrowAction(handle).pipe(
        Effect.provide(kit.layer)
      );

      expect(outcome).toEqual({ _tag: "Confirmed" });
      expect(executeAction).toHaveBeenCalledExactlyOnceWith(
        borrowEntryIntake.command
      );
      expect(yield* Ref.get(handle.handoff)).toEqual({
        _tag: "Waiting",
        action,
      });
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          path: toWidgetPath("/borrow/steps"),
          state: makeBorrowFlowNavigationState(handle, action.id),
        },
      ]);
    })
  );

  it.effect("navigates a Market Position flow to its own Steps", () =>
    Effect.gen(function* () {
      const handle = openSession(marketPositionIntake);
      const kit = yield* makeKit();

      expect(
        yield* confirmBorrowAction(handle).pipe(Effect.provide(kit.layer))
      ).toEqual({ _tag: "Confirmed" });
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          path: toWidgetPath(`/positions/borrow/${marketId}/steps`),
          state: makeBorrowFlowNavigationState(
            handle,
            yield* handedOffActionId(handle)
          ),
        },
      ]);
    })
  );

  it.effect(
    "fails an API failure as a creation error without holding or navigating",
    () =>
      Effect.gen(function* () {
        const apiError = new ApiRequestError({
          cause: new Error("temporarily unavailable"),
          failure: { _tag: "Unreachable" },
          operation: "executeAction",
        });
        const handle = openSession();
        const kit = yield* makeKit({
          executeAction: () => Effect.fail(apiError),
        });

        const error = yield* Effect.flip(
          confirmBorrowAction(handle).pipe(Effect.provide(kit.layer))
        );

        expect(error).toMatchObject({
          _tag: "BorrowActionCreationFailed",
          cause: apiError,
        });
        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect.each([
    {
      error: { _tag: "BorrowActionRejected", reason: "Insufficient WETH." },
      failure: {
        _tag: "ErrorStatus",
        body: { message: "Insufficient WETH." },
        status: 412,
      },
    },
    {
      error: { _tag: "BorrowActionCreationFailed" },
      failure: {
        _tag: "ErrorStatus",
        body: { message: "Internal server error" },
        status: 500,
      },
    },
  ] as const)(
    "creates $error._tag from an API $failure.status",
    ({ error, failure }) =>
      Effect.gen(function* () {
        const kit = yield* makeKit({
          executeAction: () =>
            Effect.fail(
              new ApiRequestError({
                cause: undefined,
                failure,
                operation: "borrow-action-create",
              })
            ),
        });

        const confirmError = yield* Effect.flip(
          confirmBorrowAction(openSession()).pipe(Effect.provide(kit.layer))
        );

        expect(confirmError).toMatchObject(error);
      })
  );

  it.effect.each(["FAILED", "SUCCESS", "CANCELED", "STALE"])(
    "fails an immediately terminal %s action as a creation error",
    (status) =>
      Effect.gen(function* () {
        const handle = openSession();
        const kit = yield* makeKit({
          executeAction: () => Effect.succeed(makeAction(status)),
        });

        const error = yield* Effect.flip(
          confirmBorrowAction(handle).pipe(Effect.provide(kit.layer))
        );

        expect(error).toMatchObject({ _tag: "BorrowActionCreationFailed" });
        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect(
    "rejects another confirmation while the handed-off action waits, without creating one",
    () =>
      Effect.gen(function* () {
        const first = makeAction("CREATED", "first");
        const executeAction = vi.fn<
          BorrowOperations["Service"]["executeAction"]
        >(() => Effect.succeed(first));
        const handle = openSession();
        const kit = yield* makeKit({ executeAction });

        const confirmed = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer)
        );
        const duplicate = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer)
        );

        expect(confirmed).toEqual({ _tag: "Confirmed" });
        expect(duplicate).toEqual({ _tag: "RejectedConfirmed" });
        expect(executeAction).toHaveBeenCalledOnce();
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action: first,
        });
        expect(yield* kit.navigation.commands).toHaveLength(1);
      })
  );

  it.effect("hands off again after Steps navigation failed", () =>
    Effect.gen(function* () {
      const second = makeAction("CREATED", "second");
      const executeAction = vi
        .fn<BorrowOperations["Service"]["executeAction"]>()
        .mockReturnValueOnce(Effect.succeed(makeAction("CREATED", "first")))
        .mockReturnValueOnce(Effect.succeed(second));
      const handle = openSession();
      const kit = yield* makeKit({
        execute: vi
          .fn<WidgetNavigation["Service"]["execute"]>(() => Effect.void)
          .mockReturnValueOnce(
            Effect.fail(new WidgetNavigationError({ cause: "blocked" }))
          ),
        executeAction,
      });

      const failed = yield* Effect.flip(
        confirmBorrowAction(handle).pipe(Effect.provide(kit.layer))
      );
      const retried = yield* confirmBorrowAction(handle).pipe(
        Effect.provide(kit.layer)
      );

      expect(failed).toMatchObject({ _tag: "WidgetNavigationError" });
      expect(retried).toEqual({ _tag: "Confirmed" });
      expect(yield* Ref.get(handle.handoff)).toEqual({
        _tag: "Waiting",
        action: second,
      });
    })
  );

  it.effect(
    "rejects a confirmation whose action was created after another was handed off",
    () =>
      Effect.gen(function* () {
        const creationStarted = yield* Deferred.make<void>();
        const creationRelease = yield* Deferred.make<void>();
        const waiting = makeAction("CREATED", "waiting");
        const handle = openSession();
        const kit = yield* makeKit({
          executeAction: () =>
            Deferred.succeed(creationStarted, undefined).pipe(
              Effect.andThen(Deferred.await(creationRelease)),
              Effect.as(makeAction("CREATED", "late"))
            ),
        });

        const confirmation = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer),
          Effect.forkChild({ startImmediately: true })
        );
        yield* Deferred.await(creationStarted);
        yield* Ref.set(handle.handoff, {
          _tag: "Waiting",
          action: waiting,
        } as const);
        yield* Deferred.succeed(creationRelease, undefined);

        expect(yield* Fiber.join(confirmation)).toEqual({
          _tag: "RejectedConfirmed",
        });
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action: waiting,
        });
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect(
    "leaves nothing handed off when interrupted while creating the action",
    () =>
      Effect.gen(function* () {
        const creationStarted = yield* Deferred.make<void>();
        const creationInterrupted = yield* Deferred.make<void>();
        const handle = openSession();
        const kit = yield* makeKit({
          executeAction: () =>
            Deferred.succeed(creationStarted, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() =>
                Deferred.succeed(creationInterrupted, undefined)
              )
            ),
        });

        const confirmation = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer),
          Effect.forkChild({ startImmediately: true })
        );
        yield* Deferred.await(creationStarted);
        yield* Fiber.interrupt(confirmation);
        const exit = yield* Fiber.await(confirmation);

        expect(Exit.hasInterrupts(exit)).toBe(true);
        expect(yield* Deferred.isDone(creationInterrupted)).toBe(true);
        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect(
    "lets an interrupted confirmation finish its Steps navigation and keep the action",
    () =>
      Effect.gen(function* () {
        const stepsStarted = yield* Deferred.make<void>();
        const stepsRelease = yield* Deferred.make<void>();
        const action = makeAction();
        const handle = openSession();
        const kit = yield* makeKit({
          execute: () =>
            Deferred.succeed(stepsStarted, undefined).pipe(
              Effect.andThen(Deferred.await(stepsRelease))
            ),
          executeAction: () => Effect.succeed(action),
        });

        const confirmation = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer),
          Effect.forkChild({ startImmediately: true })
        );
        yield* Deferred.await(stepsStarted);
        const interrupt = yield* Fiber.interrupt(confirmation).pipe(
          Effect.forkChild({ startImmediately: true })
        );
        yield* Effect.yieldNow;
        const interruptedWhileNavigating = interrupt.pollUnsafe();
        yield* Deferred.succeed(stepsRelease, undefined);
        yield* Fiber.join(interrupt);

        expect(interruptedWhileNavigating).toBeUndefined();
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action,
        });
      })
  );
});

describe("startBorrowFlowExecution", () => {
  it.effect(
    "starts the handed-off action once, so a later Execution is interrupted",
    () =>
      Effect.gen(function* () {
        const action = makeAction("CREATED", "confirmed-action");
        const handle = openSession();
        const makeWorkflow = vi.fn<
          TransactionWorkflowService["Service"]["make"]
        >((input) => Effect.succeed(idleWorkflow(input)));
        const kit = yield* makeKit({
          executeAction: () => Effect.succeed(action),
          makeWorkflow,
        });
        yield* confirmBorrowAction(handle).pipe(Effect.provide(kit.layer));

        const first = yield* Effect.exit(
          Effect.scoped(startBorrowFlowExecution(handle, action.id)).pipe(
            Effect.provide(kit.layer)
          )
        );
        const second = yield* Effect.exit(
          Effect.scoped(startBorrowFlowExecution(handle, action.id)).pipe(
            Effect.provide(kit.layer)
          )
        );

        expect(Exit.isSuccess(first)).toBe(true);
        expect(Exit.hasInterrupts(second)).toBe(true);
        expect(makeWorkflow).toHaveBeenCalledTimes(1);
        expect(makeWorkflow.mock.calls[0]?.[0]).toMatchObject({
          _tag: "Borrow",
          action,
          walletScope: handle.walletScope,
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
          startBorrowFlowExecution(openSession(), "never-handed-off")
        ).pipe(Effect.provide(kit.layer))
      );

      expect(Exit.hasInterrupts(exit)).toBe(true);
      expect(makeWorkflow).not.toHaveBeenCalled();
    })
  );

  it.effect("fails when the workflow input is invalid", () =>
    Effect.gen(function* () {
      const handle = openSession();
      const kit = yield* makeKit({
        makeWorkflow: () =>
          Effect.fail(
            new TransactionWorkflowInputError({
              message: "invalid workflow input",
              workflowId: TransactionWorkflowId.make("workflow"),
            })
          ),
      });
      yield* confirmBorrowAction(handle).pipe(Effect.provide(kit.layer));
      const actionId = yield* handedOffActionId(handle);

      const error = yield* Effect.flip(
        Effect.scoped(startBorrowFlowExecution(handle, actionId)).pipe(
          Effect.provide(kit.layer)
        )
      );

      expect(error).toMatchObject({ _tag: "TransactionWorkflowInputError" });
      expect(yield* Ref.get(handle.handoff)).toBeNull();
    })
  );

  it.effect("ends the workflow when the caller's Scope closes", () =>
    Effect.gen(function* () {
      let workflowsClosed = 0;
      const handle = openSession();
      const kit = yield* makeKit({
        makeWorkflow: (input) =>
          Effect.addFinalizer(() =>
            Effect.sync(() => {
              workflowsClosed += 1;
            })
          ).pipe(Effect.as(idleWorkflow(input))),
      });
      yield* confirmBorrowAction(handle).pipe(Effect.provide(kit.layer));
      const actionId = yield* handedOffActionId(handle);

      const executionScope = yield* Scope.make();
      yield* startBorrowFlowExecution(handle, actionId).pipe(
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
    "holds the action while its Execution runs, so Confirm creates no other",
    () =>
      Effect.gen(function* () {
        const action = makeAction("CREATED", "running-action");
        const executeAction = vi.fn<
          BorrowOperations["Service"]["executeAction"]
        >(() => Effect.succeed(action));
        const handle = openSession();
        const kit = yield* makeKit({ executeAction });
        yield* confirmBorrowAction(handle).pipe(Effect.provide(kit.layer));
        const executionScope = yield* Scope.make();
        yield* startBorrowFlowExecution(handle, action.id).pipe(
          Scope.provide(executionScope),
          Effect.provide(kit.layer)
        );

        // Review stays interactive until Steps commits.
        const whileRunning = yield* confirmBorrowAction(handle).pipe(
          Effect.provide(kit.layer)
        );
        const heldWhileRunning = yield* Ref.get(handle.handoff);
        yield* Scope.close(executionScope, Exit.void);

        expect(whileRunning).toEqual({ _tag: "RejectedConfirmed" });
        expect(executeAction).toHaveBeenCalledTimes(1);
        expect(heldWhileRunning).toEqual({ _tag: "Running", action });
        expect(yield* Ref.get(handle.handoff)).toBeNull();
      })
  );
});

describe("leaveBorrowFlow", () => {
  const leave = (intake: BorrowTransactionFlowIntake) =>
    Effect.gen(function* () {
      const kit = yield* makeKit();
      yield* leaveBorrowFlow(
        new BorrowFlowSession({ intake, walletScope })
      ).pipe(Effect.provide(kit.layer));
      return yield* kit.navigation.commands;
    });

  it.effect("replaces the flow with Borrow for a Borrow Entry flow", () =>
    Effect.gen(function* () {
      expect(yield* leave(borrowEntryIntake)).toEqual([
        { _tag: "Replace", path: toWidgetPath("/borrow") },
      ]);
    })
  );

  it.effect(
    "replaces the flow with its position for a Market Position flow",
    () =>
      Effect.gen(function* () {
        expect(yield* leave(marketPositionIntake)).toEqual([
          {
            _tag: "Replace",
            path: toWidgetPath(`/positions/borrow/${marketId}`),
          },
        ]);
      })
  );

  it.effect("lets an interrupted leave navigation finish first", () =>
    Effect.gen(function* () {
      const leaveStarted = yield* Deferred.make<void>();
      const leaveRelease = yield* Deferred.make<void>();
      const kit = yield* makeKit({
        execute: () =>
          Deferred.succeed(leaveStarted, undefined).pipe(
            Effect.andThen(Deferred.await(leaveRelease))
          ),
      });

      const leaving = yield* leaveBorrowFlow(openSession()).pipe(
        Effect.provide(kit.layer),
        Effect.forkChild({ startImmediately: true })
      );
      yield* Deferred.await(leaveStarted);
      const interrupt = yield* Fiber.interrupt(leaving).pipe(
        Effect.forkChild({ startImmediately: true })
      );
      yield* Effect.yieldNow;
      const interruptedWhileLeaving = interrupt.pollUnsafe();
      yield* Deferred.succeed(leaveRelease, undefined);
      yield* Fiber.join(interrupt);

      expect(interruptedWhileLeaving).toBeUndefined();
      expect(yield* kit.navigation.commands).toEqual([
        { _tag: "Replace", path: toWidgetPath("/borrow") },
      ]);
    })
  );
});
