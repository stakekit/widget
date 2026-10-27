import { describe, expect, it, vi } from "@effect/vitest";
import {
  Cause,
  Deferred,
  Effect,
  Layer,
  Option,
  Ref,
  Schema,
  Stream,
} from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { Action } from "../../../src/domain/borrow/execution/action";
import { Transaction } from "../../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowIntake,
  getBorrowTransactionFlowDestination,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { emptyBorrowExecutionView } from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-workflow";
import { makeBorrowFlowExecutionPage } from "../../../src/features/borrow-transaction-flow/state/execution-page";
import {
  BorrowFlowReviewVisit,
  borrowFlowReviewPage,
  makeBorrowFlowReviewPage,
} from "../../../src/features/borrow-transaction-flow/state/review-page";
import { BorrowOperations } from "../../../src/services/api/operations";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { widgetRoutes } from "../../../src/services/navigation/widget-routes";
import { initializeTransactionWorkflow } from "../../../src/services/transaction-workflow/internal/model";
import type { TransactionWorkflowCommand } from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import { borrowEntryFlowEntry } from "../../utils/borrow-flow-entry";
import { makeTestNavigation } from "../../utils/services/widget-navigation";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "base" });
const intake: BorrowTransactionFlowIntake = {
  riskVerdict: { _tag: "Allow" },
  command: {
    action: "borrow",
    address,
    args: { marketId: Schema.decodeSync(MarketId)("market-1") },
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

const action = Schema.decodeSync(Action)({
  action: "borrow",
  address,
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "provider-1",
  rawArguments: intake.command.args,
  status: "CREATED",
  totalSteps: 1,
  transactions: [
    Schema.encodeSync(Transaction)(
      Schema.decodeSync(Transaction)({
        address,
        chainId: "8453",
        id: "transaction-1",
        network: "base",
        signablePayload: "0x00",
        signingFormat: "EVM_TRANSACTION",
        status: "WAITING_FOR_SIGNATURE",
        type: "BORROW",
      })
    ),
  ],
});

const unexpected = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`borrow flow pages test: unexpected call to ${method}`);

type HarnessOptions = Readonly<{
  readonly dispatch?: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly executeAction?: BorrowOperations["Service"]["executeAction"];
}>;

// Page operations run on the wallet runtime; the test replaces its layer with
// fakes for exactly the services Review and Execution use.
const makeHarness = Effect.fn("test.makeBorrowPageHarness")(function* ({
  dispatch = () => Effect.void,
  executeAction = () => Effect.succeed(action),
}: HarnessOptions = {}) {
  const navigation = yield* makeTestNavigation();
  const workflowClosed = yield* Deferred.make<void>();
  const layer = Layer.mergeAll(
    navigation.layer,
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction,
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
        leaveGuarded: Stream.make(false),
        make: (input) =>
          Effect.addFinalizer(() =>
            Deferred.succeed(workflowClosed, undefined)
          ).pipe(
            Effect.as({
              dispatch,
              states: Stream.succeed(initializeTransactionWorkflow(input)),
            })
          ),
      })
    )
  );
  const registry = AtomRegistry.make({
    initialValues: [Atom.initialValue(walletRuntime.layer, layer as never)],
  });
  yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
  const handle = new BorrowFlowSession({ intake, walletScope });

  return {
    awaitValue: <A>(
      atom: Atom.Atom<A>,
      predicate: (value: A) => boolean
    ): Effect.Effect<A> =>
      AtomRegistry.toStream(registry, atom).pipe(
        Stream.filter(predicate),
        Stream.runHead,
        Effect.map(Option.getOrThrow)
      ),
    handle,
    navigation,
    registry,
    workflowClosed,
  } as const;
});

describe("Borrow flow Review page", () => {
  it.effect(
    "shows Confirm pending while the action is created, then hands it off",
    () =>
      Effect.gen(function* () {
        const creationRelease = yield* Deferred.make<void>();
        const { awaitValue, handle, navigation, registry } = yield* makeHarness(
          {
            executeAction: () =>
              Deferred.await(creationRelease).pipe(Effect.as(action)),
          }
        );
        const page = makeBorrowFlowReviewPage(handle);
        registry.mount(page.confirmAtom);

        expect(registry.get(page.confirmAtom)).toEqual({
          failure: Option.none(),
          pending: false,
        });
        registry.set(page.confirmAtom, undefined);
        expect(registry.get(page.confirmAtom).pending).toBe(true);

        yield* Deferred.succeed(creationRelease, undefined);
        expect(
          yield* awaitValue(
            page.confirmAtom,
            (confirmation) => !confirmation.pending
          )
        ).toEqual({ failure: Option.none(), pending: false });
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action,
        });
        expect(yield* navigation.commands).toEqual([
          {
            _tag: "Push",
            to: getBorrowTransactionFlowDestination(intake.entry).steps({
              borrowFlowSession: handle,
              executionActionId: action.id,
            }),
          },
        ]);
      })
  );

  it.effect(
    "releases an action no Steps took when Review is visited again",
    () =>
      Effect.gen(function* () {
        const { awaitValue, handle, navigation, registry } =
          yield* makeHarness();
        const confirmOnVisit = (visit: string) => {
          const pageAtom = borrowFlowReviewPage(
            new BorrowFlowReviewVisit({ session: handle, visit })
          );
          registry.mount(pageAtom);
          const { confirmAtom } = registry.get(pageAtom);
          registry.mount(confirmAtom);
          registry.set(confirmAtom, undefined);
          return awaitValue(confirmAtom, (current) => !current.pending);
        };

        yield* confirmOnVisit("first");
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action,
        });
        // Steps never showed for that handoff; Review shows again.
        yield* confirmOnVisit("second");

        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          action,
        });
        expect(yield* navigation.commands).toHaveLength(2);
      })
  );

  it.effect("shows a failed creation as a Review confirmation failure", () =>
    Effect.gen(function* () {
      const { awaitValue, handle, navigation, registry } = yield* makeHarness({
        executeAction: () =>
          Effect.fail(
            new ApiRequestError({
              cause: new Error("temporarily unavailable"),
              failure: { _tag: "Unreachable" },
              operation: "executeAction",
            })
          ),
      });
      const page = makeBorrowFlowReviewPage(handle);
      registry.mount(page.confirmAtom);

      registry.set(page.confirmAtom, undefined);
      const confirmation = yield* awaitValue(page.confirmAtom, (current) =>
        Option.isSome(current.failure)
      );

      expect(confirmation).toEqual({
        failure: Option.some({ _tag: "Failed" }),
        pending: false,
      });
      expect(yield* Ref.get(handle.handoff)).toBeNull();
      expect(yield* navigation.commands).toEqual([]);
    })
  );

  it.effect(
    "interrupts an action still being created when Review unmounts",
    () =>
      Effect.gen(function* () {
        const creationStarted = yield* Deferred.make<void>();
        const creationInterrupted = yield* Deferred.make<void>();
        const { handle, navigation, registry } = yield* makeHarness({
          executeAction: () =>
            Deferred.succeed(creationStarted, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() =>
                Deferred.succeed(creationInterrupted, undefined)
              )
            ),
        });
        const page = makeBorrowFlowReviewPage(handle);
        const unmount = registry.mount(page.confirmAtom);

        registry.set(page.confirmAtom, undefined);
        yield* Deferred.await(creationStarted);
        unmount();
        yield* Deferred.await(creationInterrupted);

        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* navigation.commands).toEqual([]);
      })
  );

  it.effect("goes back to where the flow began", () =>
    Effect.gen(function* () {
      const { handle, navigation, registry } = yield* makeHarness();
      const page = makeBorrowFlowReviewPage(handle);
      registry.mount(page.backAtom);

      registry.set(page.backAtom, undefined);
      yield* AtomRegistry.getResult(registry, page.backAtom, {
        suspendOnWaiting: true,
      });

      expect(yield* navigation.commands).toEqual([
        { _tag: "Replace", to: widgetRoutes.borrow.build("Dashboard") },
      ]);
    })
  );
});

describe("Borrow flow Execution page", () => {
  it.effect(
    "fails its workflow and shows the empty view when nothing was handed off",
    () =>
      Effect.gen(function* () {
        const { awaitValue, handle, registry } = yield* makeHarness();
        const page = makeBorrowFlowExecutionPage(handle, action.id);
        registry.mount(page.viewAtom);

        const workflow = yield* awaitValue(
          page.workflowAtom,
          AsyncResult.isFailure
        );

        expect(
          AsyncResult.isFailure(workflow) && Cause.hasInterrupts(workflow.cause)
        ).toBe(true);
        expect(registry.get(page.viewAtom)).toBe(emptyBorrowExecutionView);
      })
  );

  it.effect(
    "projects the handed-off action's workflow and forwards its commands",
    () =>
      Effect.gen(function* () {
        const dispatch = vi.fn(
          (_command: TransactionWorkflowCommand) => Effect.void
        );
        const { awaitValue, handle, registry } = yield* makeHarness({
          dispatch,
        });
        yield* Ref.set(handle.handoff, { _tag: "Waiting", action } as const);
        const page = makeBorrowFlowExecutionPage(handle, action.id);
        registry.mount(page.viewAtom);
        registry.mount(page.dispatchAtom);

        const view = yield* awaitValue(
          page.viewAtom,
          (current) => current.action !== null
        );
        registry.set(page.dispatchAtom, { _tag: "Retry" });
        yield* AtomRegistry.getResult(registry, page.dispatchAtom, {
          suspendOnWaiting: true,
        });

        expect(view.action?.id).toBe(action.id);
        expect(view.currentTransaction?.id).toBe("transaction-1");
        expect(dispatch).toHaveBeenCalledExactlyOnceWith({ _tag: "Retry" });
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Running",
          action,
        });
      })
  );

  it.effect("ends the workflow when the page unmounts", () =>
    Effect.gen(function* () {
      const { awaitValue, handle, registry, workflowClosed } =
        yield* makeHarness();
      yield* Ref.set(handle.handoff, { _tag: "Waiting", action } as const);
      const page = makeBorrowFlowExecutionPage(handle, action.id);
      const unmount = registry.mount(page.viewAtom);

      yield* awaitValue(page.viewAtom, (current) => current.action !== null);
      const closedWhileMounted = yield* Deferred.isDone(workflowClosed);
      unmount();
      yield* Deferred.await(workflowClosed);

      expect(closedWhileMounted).toBe(false);
    })
  );

  it.effect("leaves for where the flow began", () =>
    Effect.gen(function* () {
      const { handle, navigation, registry } = yield* makeHarness();
      const page = makeBorrowFlowExecutionPage(handle, action.id);
      registry.mount(page.leaveAtom);

      registry.set(page.leaveAtom, undefined);
      yield* AtomRegistry.getResult(registry, page.leaveAtom, {
        suspendOnWaiting: true,
      });

      expect(yield* navigation.commands).toEqual([
        { _tag: "Replace", to: widgetRoutes.borrow.build("Dashboard") },
      ]);
    })
  );
});
