import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  type ClassicTransactionFlowIntake,
  makeClassicFlowSession,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../../src/features/classic-transaction-flow/state/atoms/classic-flow-session";
import type { ClassicFlowSessionHandle } from "../../src/features/classic-transaction-flow/state/orchestration/classic-flow-session";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import type { ActionMeta } from "../../src/public-api/types";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import { ClassicTransactionWorkflowInput } from "../../src/services/transaction-workflow/transaction-workflow-model";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const selectedStake = yieldApiYieldFixture();
const intake: Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Enter" }
> = {
  _tag: "Enter",
  gasFeeToken: selectedStake.mechanics.gasFeeToken,
  providersDetails: [],
  request: {
    address,
    arguments: { amount: "1" },
    yieldId: selectedStake.id,
  },
  selectedStake,
  selectedToken: selectedStake.token,
  selectedValidators: new Map(),
  walletScope,
};
const session = makeClassicFlowSession(
  { intake, mount: { _tag: "Earn" } },
  walletScope
);

const action = yieldApiActionFixture({
  id: "action-1",
  yieldId: selectedStake.id,
});
const transaction = yieldApiTransactionFixture({
  id: "transaction-1",
  network: "ethereum",
  status: "CREATED",
  stepIndex: 0,
});
const actionMeta = {
  actionId: action.id,
  actionType: "stake",
  address,
  amount: "1",
  inputToken: undefined,
  providersDetails: [],
  yieldId: selectedStake.id,
} as unknown as ActionMeta;

describe("Classic Flow Atom bridge", () => {
  it.effect(
    "binds Review and Execution handles to route scope and forwards their commands",
    () =>
      Effect.gen(function* () {
        const sessionProbes = { opened: 0, closed: 0 };
        const reviewProbes = { acquired: 0, released: 0 };
        const executionProbes = { acquired: 0, released: 0 };
        const reviewConfirm = vi.fn(() =>
          Effect.succeed({ _tag: "Confirmed" } as const)
        );
        const executionBack = vi.fn(() => Effect.void);
        const executionFinish = vi.fn(() => Effect.void);
        const workflowDispatch = vi.fn(() => Effect.void);
        const workflowState = initializeTransactionWorkflow(
          new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [transaction],
            walletScope,
            yieldId: selectedStake.id,
          })
        );
        const sessionHandle: ClassicFlowSessionHandle = {
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
                return {
                  confirm: reviewConfirm,
                  states: Stream.succeed({
                    preview: { _tag: "Success", action },
                  } as const),
                };
              }),
              () =>
                Effect.sync(() => {
                  reviewProbes.released += 1;
                })
            ),
          intake: session.intake,
        };
        const openedSessions: Array<unknown> = [];
        const service = ClassicTransactionFlowService.of({
          openSession: (opened) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                sessionProbes.opened += 1;
                openedSessions.push(opened);
                return sessionHandle;
              }),
              () =>
                Effect.sync(() => {
                  sessionProbes.closed += 1;
                })
            ),
          start: () => Effect.die("Not used"),
        });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(ClassicTransactionFlowService, service) as never
            ),
          ],
        });

        const sessionRootAtom = makeClassicFlowSessionModule(session);
        const releaseSession = registry.mount(sessionRootAtom);
        const sessionModule = registry.get(sessionRootAtom);
        expect(sessionModule.facade.intake).toBe(session.intake);
        expect(sessionModule.facade.getIntake("Enter")).toBe(session.intake);
        expect(() => sessionModule.facade.getIntake("Exit")).toThrow();

        const reviewRootAtom = makeClassicFlowReviewScope(sessionModule);
        const reviewModule = registry.get(reviewRootAtom);
        const releaseReview = registry.mount(reviewRootAtom);
        registry.set(reviewModule.facade.confirmAtom, undefined);

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(sessionProbes.opened).toBe(1);
            expect(reviewProbes.acquired).toBe(1);
            expect(reviewConfirm).toHaveBeenCalledOnce();
          })
        );
        expect(openedSessions).toEqual([session]);
        releaseReview();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(reviewProbes.released).toBe(1))
        );

        const executionRootAtom = makeClassicFlowExecutionScope(sessionModule);
        const executionModule = registry.get(executionRootAtom);
        const releaseExecution = registry.mount(executionRootAtom);
        registry.set(executionModule.facade.workflow.dispatchAtom, {
          _tag: "Retry",
        });
        registry.set(executionModule.facade.backAtom, undefined);
        registry.set(executionModule.facade.finishAtom, undefined);

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            const view = registry.get(executionModule.facade.workflow.viewAtom);
            expect(executionProbes.acquired).toBe(1);
            expect(view.state).toBe(workflowState);
            expect(view.steps.txStates.map((state) => state.tx.id)).toEqual([
              transaction.id,
            ]);
            expect(workflowDispatch).toHaveBeenCalledWith({ _tag: "Retry" });
            expect(executionBack).toHaveBeenCalledOnce();
            expect(executionFinish).toHaveBeenCalledOnce();
          })
        );
        releaseExecution();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(executionProbes.released).toBe(1))
        );
        expect(sessionProbes.closed).toBe(0);

        releaseSession();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(sessionProbes.closed).toBe(1))
        );
        expect(sessionProbes.opened).toBe(1);
        registry.dispose();
      })
  );
});
