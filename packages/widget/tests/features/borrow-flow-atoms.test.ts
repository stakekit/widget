import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type {
  BorrowFlowSession,
  BorrowTransactionFlowIntake,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  currentBorrowFlowSessionAtom,
  startBorrowTransactionFlowAtom,
} from "../../src/features/borrow-transaction-flow/state/atoms/borrow-flow";
import {
  currentBorrowFlowSessionRootAtom,
  makeBorrowFlowExecutionScope,
  makeBorrowFlowReviewScope,
} from "../../src/features/borrow-transaction-flow/state/atoms/borrow-flow-session";
import type { BorrowFlowSessionHandle } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-flow-session";
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

const makeSession = (epoch: number): BorrowFlowSession => ({
  epoch,
  intake,
  walletScope,
});

const transaction = Schema.decodeUnknownSync(Transaction)({
  address,
  chainId: "8453",
  id: "transaction-1",
  network: "base",
  signablePayload: "0x00",
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "BORROW",
});

const action = Schema.decodeUnknownSync(Action)({
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

const makeSessionHandle = (): BorrowFlowSessionHandle => ({
  acquireExecution: () =>
    Effect.succeed({ _tag: "RejectedNoReservation" } as const),
  acquireReview: () =>
    Effect.succeed({
      back: () => Effect.succeed({ _tag: "Accepted" } as const),
      confirm: () => Effect.succeed({ _tag: "Confirmed" } as const),
    }),
  intake,
});

describe("Borrow Flow Atom bridge", () => {
  it.effect(
    "projects service state and binds Session acquisition to the root Atom lifetime",
    () =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.make<BorrowFlowSession | null>(
          null
        );
        const probes = { acquired: 0, released: 0 };
        const startInputs: Array<BorrowTransactionFlowIntake> = [];
        const service = BorrowTransactionFlowService.of({
          acquireSession: () =>
            Effect.acquireRelease(
              Effect.sync(() => {
                probes.acquired += 1;
                return {
                  _tag: "Acquired",
                  session: makeSessionHandle(),
                } as const;
              }),
              () =>
                Effect.sync(() => {
                  probes.released += 1;
                }).pipe(Effect.andThen(SubscriptionRef.set(current, null)))
            ),
          currentSession: SubscriptionRef.changes(current),
          start: (input) =>
            Effect.gen(function* () {
              startInputs.push(input);
              const session = makeSession(1);
              yield* SubscriptionRef.set(current, session);
              return { _tag: "Started", session } as const;
            }),
        });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(BorrowTransactionFlowService, service) as never
            ),
          ],
        });

        registry.set(startBorrowTransactionFlowAtom, intake);
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(currentBorrowFlowSessionAtom)?.epoch).toBe(1)
          )
        );
        expect(startInputs).toEqual([intake]);

        const rootAtom = registry.get(currentBorrowFlowSessionRootAtom);
        if (!rootAtom)
          throw new Error("Expected a Borrow Flow Session root Atom");
        const releaseRoot = registry.mount(rootAtom);
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(probes.acquired).toBe(1))
        );

        releaseRoot();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(probes.released).toBe(1))
        );
        registry.dispose();
      })
  );

  it.effect(
    "binds Review and Execution handles to route scope and forwards their commands",
    () =>
      Effect.gen(function* () {
        const session = makeSession(1);
        const current = yield* SubscriptionRef.make<BorrowFlowSession | null>(
          session
        );
        const reviewProbes = { acquired: 0, released: 0 };
        const executionProbes = { acquired: 0, released: 0 };
        const reviewBack = vi.fn(() =>
          Effect.succeed({ _tag: "Accepted" } as const)
        );
        const reviewConfirm = vi.fn(() =>
          Effect.succeed({ _tag: "Confirmed" } as const)
        );
        const executionBack = vi.fn(() =>
          Effect.succeed({ _tag: "Accepted" } as const)
        );
        const executionFinish = vi.fn(() =>
          Effect.succeed({ _tag: "Accepted" } as const)
        );
        const workflowDispatch = vi.fn(() =>
          Effect.succeed({ _tag: "Accepted" } as const)
        );
        const workflowState = initializeTransactionWorkflow(
          new BorrowTransactionWorkflowInput({ action, walletScope })
        );
        const sessionHandle: BorrowFlowSessionHandle = {
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
          acquireSession: () =>
            Effect.acquireRelease(
              Effect.succeed({
                _tag: "Acquired",
                session: sessionHandle,
              } as const),
              () => Effect.void
            ),
          currentSession: SubscriptionRef.changes(current),
          start: () => Effect.succeed({ _tag: "Started", session } as const),
        });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(BorrowTransactionFlowService, service) as never
            ),
          ],
        });

        const sessionRootAtom = registry.get(currentBorrowFlowSessionRootAtom);
        if (!sessionRootAtom) throw new Error("Expected a Session root Atom");
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
