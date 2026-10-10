import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowIntake,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  makeBorrowFlowExecutionScope,
  makeBorrowFlowReviewScope,
  makeBorrowFlowSessionModule,
} from "../../src/features/borrow-transaction-flow/state/atoms/borrow-flow-session";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import { BorrowTransactionWorkflowInput } from "../../src/services/transaction-workflow/transaction-workflow-model";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
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

const session = new BorrowFlowSession({ intake, walletScope });

const transaction = Schema.decodeSync(Transaction)({
  address,
  chainId: "8453",
  id: "transaction-1",
  network: "base",
  signablePayload: "0x00",
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "BORROW",
});

const action = Schema.decodeSync(Action)({
  action: "borrow",
  address,
  createdAt: "2026-01-01T00:00:00.000Z",
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "provider-1",
  rawArguments: intake.command.args,
  status: "CREATED",
  totalSteps: 1,
  transactions: [Schema.encodeSync(Transaction)(transaction)],
});

describe("Borrow Flow Atom bridge", () => {
  it.effect(
    "binds Review and Execution handles to route scope and forwards their commands",
    () =>
      Effect.gen(function* () {
        const reviewProbes = { acquired: 0, released: 0 };
        const executionProbes = { acquired: 0, released: 0 };
        const reviewBack = vi.fn(() => Effect.void);
        const reviewConfirm = vi.fn(() =>
          Effect.succeed({ _tag: "Confirmed" } as const)
        );
        const executionBack = vi.fn(() => Effect.void);
        const executionFinish = vi.fn(() =>
          Effect.succeed({ _tag: "Accepted" } as const)
        );
        const workflowDispatch = vi.fn(() => Effect.void);
        const workflowState = initializeTransactionWorkflow(
          new BorrowTransactionWorkflowInput({ action, walletScope })
        );
        const sessionHandle = {
          acquireExecution: () =>
            Effect.acquireRelease(
              Effect.sync(() => {
                executionProbes.acquired += 1;
                return {
                  _tag: "Acquired",
                  execution: {
                    back: executionBack,
                    finish: executionFinish,
                    runWorkflow: workflowDispatch,
                    states: Stream.succeed(workflowState),
                  },
                } as const;
              }),
              () =>
                Effect.sync(() => {
                  executionProbes.released += 1;
                })
            ),
          acquireReview: () =>
            Effect.acquireRelease(
              Effect.sync(() => {
                reviewProbes.acquired += 1;
                return { back: reviewBack, confirm: reviewConfirm };
              }),
              () =>
                Effect.sync(() => {
                  reviewProbes.released += 1;
                })
            ),
          intake,
        };
        const service = BorrowTransactionFlowService.of({
          openSession: () => Effect.succeed(sessionHandle),
          start: () => Effect.die("Not used"),
        });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(BorrowTransactionFlowService, service) as never
            ),
          ],
        });

        const sessionRootAtom = makeBorrowFlowSessionModule(session);
        const releaseSession = registry.mount(sessionRootAtom);
        const sessionModule = registry.get(sessionRootAtom);

        const reviewRootAtom = makeBorrowFlowReviewScope(sessionModule);
        const reviewModule = registry.get(reviewRootAtom);
        const releaseReview = registry.mount(reviewRootAtom);
        registry.set(reviewModule.facade.confirmAtom, undefined);
        registry.set(reviewModule.facade.backAtom, undefined);

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(reviewProbes.acquired).toBe(1);
            expect(reviewConfirm).toHaveBeenCalledOnce();
            expect(reviewBack).toHaveBeenCalledOnce();
          })
        );
        releaseReview();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(reviewProbes.released).toBe(1))
        );

        const executionRootAtom = makeBorrowFlowExecutionScope(sessionModule);
        const executionModule = registry.get(executionRootAtom);
        const releaseExecution = registry.mount(executionRootAtom);
        registry.set(executionModule.facade.workflowCommandAtom, {
          _tag: "Retry",
        });
        registry.set(executionModule.facade.backAtom, undefined);
        registry.set(executionModule.facade.finishAtom, undefined);

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            const view = registry.get(executionModule.facade.viewAtom);
            expect(executionProbes.acquired).toBe(1);
            expect(view.action?.id).toBe(action.id);
            expect(view.currentTransaction?.id).toBe(transaction.id);
            expect(workflowDispatch).toHaveBeenCalledWith({ _tag: "Retry" });
            expect(executionBack).toHaveBeenCalledOnce();
            expect(executionFinish).toHaveBeenCalledOnce();
          })
        );
        releaseExecution();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(executionProbes.released).toBe(1))
        );

        releaseSession();
        registry.dispose();
      })
  );
});
