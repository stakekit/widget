import {
  make as makeScopedAtom,
  RegistryProvider,
  useAtomValue,
} from "@effect/atom-react";
import { Deferred, Effect, Layer, Schema } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { createContext, useContext } from "react";
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { actionHistoryRevisionAtom } from "../../src/features/classic-transaction-flow/state";
import { makeClassicTransactionWorkflowModule } from "../../src/features/classic-transaction-flow/state/classic-transaction-workflow";
import type { ActionMeta } from "../../src/public-api/types";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { ClassicTransactionWorkflowInput } from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../../src/services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import { yieldApiTransactionFixture } from "../fixtures";
import { render } from "../utils/test-utils";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const key = new ClassicTransactionWorkflowInput({
  actionMeta: {
    actionId: "action-1",
    address,
  } as unknown as ActionMeta,
  transactions: [
    yieldApiTransactionFixture({
      id: "tx-1",
      network: "ethereum",
      status: "CREATED",
      unsignedTransaction: "unsigned-payload",
    }),
  ],
  walletScope,
  yieldId,
});
const WorkflowScopedAtom = makeScopedAtom(
  (workflowKey: ClassicTransactionWorkflowInput) =>
    makeClassicTransactionWorkflowModule(workflowKey)
);
const useWorkflowScopedAtom = WorkflowScopedAtom.use;
type WorkflowModule = Atom.Type<
  ReturnType<typeof makeClassicTransactionWorkflowModule>
>;
const WorkflowContext = createContext<WorkflowModule | null>(null);

const ClassicTransactionWorkflowRoute = ({
  workflowKey,
}: {
  readonly workflowKey: ClassicTransactionWorkflowInput;
}) => (
  <WorkflowScopedAtom.Provider value={workflowKey}>
    <ClassicTransactionWorkflowBinding />
  </WorkflowScopedAtom.Provider>
);

const ClassicTransactionWorkflowBinding = () => {
  const workflowAtom = useWorkflowScopedAtom();
  const workflow = useAtomValue(workflowAtom);

  return (
    <WorkflowContext.Provider value={workflow}>
      <Outlet />
    </WorkflowContext.Provider>
  );
};

const WorkflowProbe = () => {
  const workflow = useContext(WorkflowContext);
  if (!workflow) throw new Error("Expected a workflow");
  const view = useAtomValue(workflow.viewAtom);
  const actionHistoryRevision = useAtomValue(actionHistoryRevisionAtom);
  if (!view) throw new Error("Expected workflow input");
  const { state } = view;
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="state">{state._tag}</div>
      <div data-testid="action-history">
        {actionHistoryRevision === 0 ? "unchanged" : "changed"}
      </div>
      <button type="button" onClick={() => navigate(-1)}>
        Leave workflow
      </button>
    </>
  );
};

describe("classic transaction workflow browser integration", () => {
  it("starts automatically and completes through the derived workflow atom", async () => {
    const signTransaction = vi.fn(() =>
      Effect.succeed({
        broadcasted: false as const,
        signedTx: "signed-payload",
      })
    );
    const submitClassicSigned = vi.fn(() => Effect.void);
    const operations = {
      completeWorkflow: () => Effect.void,
      getBorrowAction: () => Effect.die("unexpected borrow status"),
      getClassicStatus: () =>
        Effect.succeed({
          explorerUrl: "https://explorer.test/tx",
          status: "CONFIRMED" as const,
        }),
      getWalletState: Effect.succeed({
        address,
        network: "ethereum",
        status: "connected",
      }),
      signMessage: () => Effect.die("unexpected message signing"),
      signTransaction,
      stepBorrowAction: () => Effect.die("unexpected borrow step"),
      submitBorrowTransaction: () => Effect.die("unexpected borrow submission"),
      submitClassicHash: () => Effect.die("unexpected hash submission"),
      submitClassicSigned,
      submitWorkflow: () => Effect.void,
      trackEvent: () => Effect.void,
    } as unknown as TransactionWorkflowOperationsService["Service"];
    const workflowLayer = TransactionWorkflowService.layer.pipe(
      Layer.provide(
        Layer.succeed(TransactionWorkflowOperationsService, operations)
      )
    );
    const app = await render(
      <RegistryProvider
        initialValues={[[walletRuntime.layer, workflowLayer.pipe(Layer.fresh)]]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={<ClassicTransactionWorkflowRoute workflowKey={key} />}
            >
              <Route path="steps" element={<WorkflowProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("state"))
      .toHaveTextContent("Completed");
    await expect
      .element(app.getByTestId("action-history"))
      .toHaveTextContent("changed");
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(submitClassicSigned).toHaveBeenCalledOnce();

    app.unmount();
  });

  it("eventually interrupts deferred signing when the steps route unmounts", async () => {
    const signing = await Effect.runPromise(
      Deferred.make<{ broadcasted: boolean; signedTx: string }>()
    );
    const signingInterrupted = await Effect.runPromise(Deferred.make<void>());
    const signTransaction = vi.fn(() =>
      Deferred.await(signing).pipe(
        Effect.onInterrupt(() =>
          Deferred.succeed(signingInterrupted, undefined)
        )
      )
    );
    const submitClassicSigned = vi.fn(() => Effect.void);
    const operations = {
      completeWorkflow: () => Effect.void,
      getBorrowAction: () => Effect.die("unexpected borrow status"),
      getClassicStatus: () => Effect.die("unexpected confirmation"),
      getWalletState: Effect.succeed({
        address,
        network: "ethereum",
        status: "connected",
      }),
      signMessage: () => Effect.die("unexpected message signing"),
      signTransaction,
      stepBorrowAction: () => Effect.die("unexpected borrow step"),
      submitBorrowTransaction: () => Effect.die("unexpected borrow submission"),
      submitClassicHash: () => Effect.die("unexpected hash submission"),
      submitClassicSigned,
      submitWorkflow: () => Effect.void,
      trackEvent: () => Effect.void,
    } as unknown as TransactionWorkflowOperationsService["Service"];
    const workflowLayer = TransactionWorkflowService.layer.pipe(
      Layer.provide(
        Layer.succeed(TransactionWorkflowOperationsService, operations)
      )
    );
    const app = await render(
      <RegistryProvider
        initialValues={[[walletRuntime.layer, workflowLayer.pipe(Layer.fresh)]]}
      >
        <MemoryRouter initialEntries={["/", "/steps"]} initialIndex={1}>
          <Routes>
            <Route
              element={<ClassicTransactionWorkflowRoute workflowKey={key} />}
            >
              <Route path="steps" element={<WorkflowProbe />} />
            </Route>
            <Route path="/" element={<div data-testid="home">home</div>} />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect.element(app.getByTestId("state")).toHaveTextContent("Signing");
    expect(signTransaction).toHaveBeenCalledOnce();
    await app.getByRole("button", { name: "Leave workflow" }).click();
    await expect.element(app.getByTestId("home")).toHaveTextContent("home");
    await Effect.runPromise(Deferred.await(signingInterrupted));

    expect(submitClassicSigned).not.toHaveBeenCalled();
    expect(signTransaction).toHaveBeenCalledOnce();

    app.unmount();
  });

  it("interrupts deferred confirmation when the steps route unmounts", async () => {
    const confirmation = await Effect.runPromise(
      Deferred.make<{ explorerUrl: string; status: string }>()
    );
    const confirmationInterrupted = await Effect.runPromise(
      Deferred.make<void>()
    );
    const twoTransactionKey = new ClassicTransactionWorkflowInput({
      ...key,
      transactions: [
        ...key.transactions,
        yieldApiTransactionFixture({
          id: "tx-2",
          network: "ethereum",
          status: "CREATED",
          unsignedTransaction: "second-unsigned-payload",
        }),
      ],
    });
    const signTransaction = vi.fn(() =>
      Effect.succeed({
        broadcasted: false as const,
        signedTx: "signed-payload",
      })
    );
    const submitClassicSigned = vi.fn(() => Effect.void);
    const getClassicStatus = vi.fn(() =>
      Deferred.await(confirmation).pipe(
        Effect.onInterrupt(() =>
          Deferred.succeed(confirmationInterrupted, undefined)
        )
      )
    );
    const operations = {
      completeWorkflow: () => Effect.void,
      getBorrowAction: () => Effect.die("unexpected borrow status"),
      getClassicStatus,
      getWalletState: Effect.succeed({
        address,
        network: "ethereum",
        status: "connected",
      }),
      signMessage: () => Effect.die("unexpected message signing"),
      signTransaction,
      stepBorrowAction: () => Effect.die("unexpected borrow step"),
      submitBorrowTransaction: () => Effect.die("unexpected borrow submission"),
      submitClassicHash: () => Effect.die("unexpected hash submission"),
      submitClassicSigned,
      submitWorkflow: () => Effect.void,
      trackEvent: () => Effect.void,
    } as unknown as TransactionWorkflowOperationsService["Service"];
    const workflowLayer = TransactionWorkflowService.layer.pipe(
      Layer.provide(
        Layer.succeed(TransactionWorkflowOperationsService, operations)
      )
    );
    const app = await render(
      <RegistryProvider
        initialValues={[[walletRuntime.layer, workflowLayer.pipe(Layer.fresh)]]}
      >
        <MemoryRouter initialEntries={["/", "/steps"]} initialIndex={1}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowRoute
                  workflowKey={twoTransactionKey}
                />
              }
            >
              <Route path="steps" element={<WorkflowProbe />} />
            </Route>
            <Route path="/" element={<div data-testid="home">home</div>} />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("state"))
      .toHaveTextContent("Confirming");
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(submitClassicSigned).toHaveBeenCalledOnce();
    expect(getClassicStatus).toHaveBeenCalledOnce();

    await app.getByRole("button", { name: "Leave workflow" }).click();
    await expect.element(app.getByTestId("home")).toHaveTextContent("home");
    await Effect.runPromise(Deferred.await(confirmationInterrupted));
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(submitClassicSigned).toHaveBeenCalledOnce();
    expect(getClassicStatus).toHaveBeenCalledOnce();

    app.unmount();
  });
});
