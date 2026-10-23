import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Option, Schema, Stream, SubscriptionRef } from "effect";
import { act, StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { Action } from "../../../src/domain/borrow/execution/action";
import { IntegrationId, MarketId } from "../../../src/domain/borrow/ids";
import {
  TransactionWorkflowId,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  makeBorrowFlowNavigationState,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  BorrowTransactionFlowExecutionPage,
  BorrowTransactionFlowExecutionRoute,
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlowExecution,
  useBorrowTransactionFlowReview,
} from "../../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { BorrowOperations } from "../../../src/services/api/operations";
import {
  makeWidgetNavigation,
  WidgetNavigation,
} from "../../../src/services/navigation/widget-navigation";
import { initializeTransactionWorkflow } from "../../../src/services/transaction-workflow/internal/model";
import {
  TransactionWorkflowInputError,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import {
  borrowEntryFlowEntry,
  withUnserializedState,
} from "../../utils/borrow-flow-entry";
import { render } from "../../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const session = new BorrowFlowSession({
  walletScope,
  intake: {
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
      network: "ethereum",
      projectedCollateralUsd: "100",
      projectedDebtUsd: "1",
      providerName: "Provider",
      riskStatus: "unavailable",
      warnings: [],
    },
  },
});
const action = Schema.decodeSync(Action)({
  action: "borrow",
  address,
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "provider-1",
  rawArguments: { marketId: "market-1" },
  status: "CREATED",
  totalSteps: 1,
  transactions: [],
});

const ReviewProbe = () => {
  const review = useBorrowTransactionFlowReview();
  const confirmation = useAtomValue(review.confirmAtom);
  const confirm = useAtomSet(review.confirmAtom);
  return (
    <>
      <output data-testid="page">Review</output>
      <output data-testid="review-failure">
        {Option.isSome(confirmation.failure) ? "failed" : ""}
      </output>
      <button type="button" onClick={() => confirm(undefined)}>
        Confirm
      </button>
    </>
  );
};

const ExecutionProbe = ({ page }: { readonly page: "Complete" | "Steps" }) => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  return (
    <>
      <output data-testid="page">{page}</output>
      <output data-testid="view">{view.isDone ? "done" : "pending"}</output>
    </>
  );
};

type FlowOptions = Readonly<{
  readonly invalidInput?: boolean;
  readonly pathname: string;
}>;

const renderFlow = async ({ invalidInput = false, pathname }: FlowOptions) => {
  // Each Execution's workflow state, in start order; tests drive the latest.
  const workflows: Array<
    SubscriptionRef.SubscriptionRef<TransactionWorkflowState>
  > = [];
  const ended = { workflows: 0 };
  const router = createMemoryRouter(
    [
      { path: "/borrow", element: <output data-testid="page">Entry</output> },
      {
        element: <BorrowTransactionFlowRoute expected="BorrowEntry" />,
        children: [
          { path: "/borrow/review", element: <ReviewProbe /> },
          {
            element: <BorrowTransactionFlowExecutionRoute />,
            children: [
              {
                path: "/borrow/steps",
                element: (
                  <BorrowTransactionFlowExecutionPage page="Steps">
                    <ExecutionProbe page="Steps" />
                  </BorrowTransactionFlowExecutionPage>
                ),
              },
              {
                path: "/borrow/complete",
                element: (
                  <BorrowTransactionFlowExecutionPage page="Complete">
                    <ExecutionProbe page="Complete" />
                  </BorrowTransactionFlowExecutionPage>
                ),
              },
            ],
          },
        ],
      },
    ],
    {
      initialEntries: [
        withUnserializedState(
          { pathname },
          makeBorrowFlowNavigationState(session)
        ),
      ],
    }
  );
  const navigation = makeWidgetNavigation({
    back: () => Effect.promise(() => router.navigate(-1)),
    push: (path, options) =>
      Effect.promise(() => router.navigate(path, { state: options?.state })),
    replace: (path, options) =>
      Effect.promise(() =>
        router.navigate(path, { replace: true, state: options?.state })
      ),
  });
  const layer = Layer.mergeAll(
    Layer.succeed(WidgetNavigation, navigation),
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction: () => Effect.succeed(action),
        getAction: () => Effect.die("Not used"),
        stepAction: () => Effect.die("Not used"),
        submitTransaction: () => Effect.die("Not used"),
        submitTransactionInBackground: () => Effect.die("Not used"),
      })
    ),
    Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        leaveGuarded: Stream.make(false),
        make: (input) =>
          invalidInput
            ? Effect.fail(
                new TransactionWorkflowInputError({
                  message: "Invalid workflow input.",
                  workflowId: TransactionWorkflowId.make(action.id),
                })
              )
            : SubscriptionRef.make(initializeTransactionWorkflow(input)).pipe(
                Effect.tap(() =>
                  Effect.addFinalizer(() =>
                    Effect.sync(() => {
                      ended.workflows += 1;
                    })
                  )
                ),
                Effect.map((state) => {
                  workflows.push(state);
                  return {
                    dispatch: () => Effect.void,
                    states: SubscriptionRef.changes(state),
                  };
                })
              ),
      })
    )
  );
  // Production renders the widget in StrictMode; Execution must still take
  // the confirmed action exactly once.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[
          [walletScopeAtom, walletScope],
          [walletRuntime.layer, layer as never],
        ]}
      >
        <RouterProvider router={router} />
      </RegistryProvider>
    </StrictMode>
  );
  const output = (testId: string) =>
    app.container.querySelector(`[data-testid="${testId}"]`)?.textContent;
  const page = () => output("page");
  const navigate = (delta: number) =>
    act(async () => {
      await router.navigate(delta);
    });
  // Moving within the same Execution keeps its navigation state.
  const navigateWithinExecution = (to: string) =>
    act(async () => {
      await router.navigate(to, { state: router.state.location.state });
    });
  const confirm = async () => {
    await vi.waitFor(() => expect(page()).toBe("Review"));
    await act(async () => {
      [...app.container.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Confirm")
        ?.click();
    });
  };
  const setWorkflowState = (
    next: (state: TransactionWorkflowState) => TransactionWorkflowState
  ) => {
    const state = workflows.at(-1);
    if (!state) throw new Error("Expected a running Execution workflow");
    return act(async () => {
      // ast-grep-ignore: no-run-effect-in-test -- React act is a Promise-based boundary; keep Effect-driven React updates inside it.
      await Effect.runPromise(SubscriptionRef.update(state, next));
    });
  };
  const location = () => router.state.location.pathname;
  const cleanup = () => {
    app.unmount();
    router.dispose();
  };
  return {
    cleanup,
    confirm,
    ended,
    location,
    navigate,
    navigateWithinExecution,
    output,
    page,
    setWorkflowState,
    workflows,
  };
};

describe("Borrow completion admission", () => {
  it("leaves the flow when Steps is reached without a confirmed action", async () => {
    const flow = await renderFlow({ pathname: "/borrow/steps" });

    await vi.waitFor(() => expect(flow.location()).toBe("/borrow"));
    expect(flow.page()).toBe("Entry");
    expect(flow.workflows).toHaveLength(0);
    flow.cleanup();
  });

  it("leaves the flow when Complete is reached without a confirmed action", async () => {
    const flow = await renderFlow({ pathname: "/borrow/complete" });

    await vi.waitFor(() => expect(flow.location()).toBe("/borrow"));
    expect(flow.workflows).toHaveLength(0);
    flow.cleanup();
  });

  it("leaves the flow when the confirmed action is not a valid workflow input", async () => {
    const flow = await renderFlow({
      invalidInput: true,
      pathname: "/borrow/review",
    });

    await flow.confirm();

    await vi.waitFor(() => expect(flow.location()).toBe("/borrow"));
    expect(flow.page()).toBe("Entry");
    flow.cleanup();
  });

  it("admits Complete only once the workflow completes", async () => {
    const flow = await renderFlow({ pathname: "/borrow/review" });
    await flow.confirm();
    await vi.waitFor(() => expect(flow.page()).toBe("Steps"));
    expect(flow.output("view")).toBe("pending");
    expect(flow.workflows).toHaveLength(1);

    await flow.navigateWithinExecution("/borrow/complete");
    await vi.waitFor(() => expect(flow.location()).toBe("/borrow/steps"));
    expect(flow.page()).toBe("Steps");

    await flow.setWorkflowState((state) => ({
      _tag: "Completed",
      context: state.context,
    }));
    await vi.waitFor(() => expect(flow.location()).toBe("/borrow/complete"));
    expect(flow.page()).toBe("Complete");
    expect(flow.output("view")).toBe("done");

    // Steps of a finished workflow belongs to Complete.
    await flow.navigateWithinExecution("/borrow/steps");
    await vi.waitFor(() => expect(flow.location()).toBe("/borrow/complete"));
    expect(flow.page()).toBe("Complete");
    // Steps and Complete share one workflow.
    expect(flow.workflows).toHaveLength(1);
    expect(flow.ended.workflows).toBe(0);
    flow.cleanup();
  });

  it("hands the confirmed action to one Execution only", async () => {
    const flow = await renderFlow({ pathname: "/borrow/review" });
    await flow.confirm();
    await vi.waitFor(() => expect(flow.page()).toBe("Steps"));

    await flow.navigate(-1);
    await vi.waitFor(() => expect(flow.page()).toBe("Review"));
    // Leaving Steps and Complete ends their workflow.
    await vi.waitFor(() => expect(flow.ended.workflows).toBe(1));

    // History forward finds the action already taken.
    await flow.navigate(1);
    await vi.waitFor(() => expect(flow.location()).toBe("/borrow"));
    expect(flow.workflows).toHaveLength(1);
    flow.cleanup();
  });
});
