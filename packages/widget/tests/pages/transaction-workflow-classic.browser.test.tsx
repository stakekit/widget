import {
  RegistryProvider,
  useAtomMount,
  useAtomValue,
} from "@effect/atom-react";
import { Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { StrictMode } from "react";
import {
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { ClassicTransactionWorkflowContext } from "../../src/features/transaction-flow/react/classic-transaction-workflow-context";
import { makeClassicTransactionWorkflowFacade } from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import { makeTransactionWorkflowLifecycleAtom } from "../../src/features/transaction-flow/state/workflow-lifecycle";
import { useTransactionWorkflow } from "../../src/features/transaction-flow/ui/steps/hooks/use-transaction-workflow.hook";
import { currentWalletScopeAtom } from "../../src/features/wallet/state/selectors";
import type { ActionMeta } from "../../src/public-api/types";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../src/services/wallet/domain/scope";
import { ClassicTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../../src/services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import { yieldApiTransactionFixture } from "../fixtures";
import { render } from "../utils/test-utils";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const key = new ClassicTransactionWorkflowKey({
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
const workflowKeyAtom = Atom.make<ClassicTransactionWorkflowKey | null>(
  key
).pipe(Atom.keepAlive);
const workflowLifecycleAtom = makeTransactionWorkflowLifecycleAtom(
  workflowKeyAtom,
  "workflowLifecycleAtom"
);
const missingWorkflowKeyAtom = Atom.make<ClassicTransactionWorkflowKey | null>(
  null
);
const missingWorkflowLifecycleAtom = makeTransactionWorkflowLifecycleAtom(
  missingWorkflowKeyAtom,
  "missingWorkflowLifecycleAtom"
);
const workflowFacadeFamily = Atom.family(
  (keyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>) =>
    makeClassicTransactionWorkflowFacade(keyAtom)
);

const ClassicTransactionWorkflowGuard = ({
  workflowLifecycleAtom: lifecycleAtom,
  workflowKeyAtom: keyAtom,
}: {
  readonly workflowLifecycleAtom: Atom.Atom<void>;
  readonly workflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>;
}) => {
  useAtomMount(lifecycleAtom);
  const workflowKey = useAtomValue(keyAtom);
  const currentWalletScope = useAtomValue(currentWalletScopeAtom);
  const workflow = workflowFacadeFamily(keyAtom);

  return workflowKey &&
    currentWalletScope &&
    sameWalletScopeOwner(workflowKey.walletScope, currentWalletScope) ? (
    <ClassicTransactionWorkflowContext.Provider value={workflow}>
      <Outlet />
    </ClassicTransactionWorkflowContext.Provider>
  ) : (
    <Navigate to="/" replace />
  );
};

const WorkflowProbe = () => {
  const { state } = useTransactionWorkflow();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="state">{state._tag}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Leave workflow
      </button>
    </>
  );
};

const ForwardNavigation = () => {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(1)}>
      Go forward
    </button>
  );
};

const WorkflowInputProbe = ({
  inputAtom,
}: {
  inputAtom: Atom.Atom<unknown>;
}) => (
  <div data-testid="workflow-input">
    {useAtomValue(inputAtom) ? "present" : "missing"}
  </div>
);

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
        initialValues={[
          [walletRuntime.layer, workflowLayer.pipe(Layer.fresh)],
          [currentWalletScopeAtom, walletScope],
        ]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={workflowLifecycleAtom}
                  workflowKeyAtom={workflowKeyAtom}
                />
              }
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
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(submitClassicSigned).toHaveBeenCalledOnce();

    app.unmount();
  });

  it("redirects to home when workflow input is missing", async () => {
    const app = await render(
      <RegistryProvider initialValues={[[currentWalletScopeAtom, walletScope]]}>
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={missingWorkflowLifecycleAtom}
                  workflowKeyAtom={missingWorkflowKeyAtom}
                />
              }
            >
              <Route path="steps" element={<div>unexpected</div>} />
            </Route>
            <Route path="/" element={<div data-testid="home">home</div>} />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect.element(app.getByTestId("home")).toHaveTextContent("home");
    app.unmount();
  });

  it("preserves workflow input through strict-mode effect replay", async () => {
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(key).pipe(
      Atom.keepAlive
    );
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "strictModeWorkflowLifecycleAtom"
    );
    const app = await render(
      <RegistryProvider initialValues={[[currentWalletScopeAtom, walletScope]]}>
        <StrictMode>
          <MemoryRouter initialEntries={["/steps"]}>
            <Routes>
              <Route
                element={
                  <ClassicTransactionWorkflowGuard
                    workflowLifecycleAtom={lifecycleAtom}
                    workflowKeyAtom={inputAtom}
                  />
                }
              >
                <Route
                  path="steps"
                  element={<WorkflowInputProbe inputAtom={inputAtom} />}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </StrictMode>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("workflow-input"))
      .toHaveTextContent("present");
    app.unmount();
  });

  it("preserves a workflow when only additional addresses refresh", async () => {
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(key).pipe(
      Atom.keepAlive
    );
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "refreshedWalletScopeWorkflowLifecycleAtom"
    );
    const refreshedScope = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["stake-account-1"],
        stakeAccounts: ["stake-account-2"],
      },
      address,
      network: "ethereum",
    });
    const app = await render(
      <RegistryProvider
        initialValues={[[currentWalletScopeAtom, refreshedScope]]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={lifecycleAtom}
                  workflowKeyAtom={inputAtom}
                />
              }
            >
              <Route
                path="steps"
                element={<WorkflowInputProbe inputAtom={inputAtom} />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("workflow-input"))
      .toHaveTextContent("present");
    app.unmount();
  });

  it("clears and redirects a workflow captured for another wallet scope", async () => {
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(key).pipe(
      Atom.keepAlive
    );
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "mismatchedWalletScopeWorkflowLifecycleAtom"
    );
    const currentScope = new WalletScopeKey({ address, network: "base" });
    const app = await render(
      <RegistryProvider
        initialValues={[[currentWalletScopeAtom, currentScope]]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={lifecycleAtom}
                  workflowKeyAtom={inputAtom}
                />
              }
            >
              <Route path="steps" element={<div>unexpected</div>} />
            </Route>
            <Route
              path="/"
              element={<WorkflowInputProbe inputAtom={inputAtom} />}
            />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("workflow-input"))
      .toHaveTextContent("missing");
    app.unmount();
  });

  it("rejects a case-distinct wallet on a case-sensitive network", async () => {
    const capturedAddress = Schema.decodeSync(WalletAddress)("SolanaWalletA");
    const currentAddress = Schema.decodeSync(WalletAddress)("solanawalleta");
    const capturedScope = new WalletScopeKey({
      address: capturedAddress,
      network: "solana",
    });
    const currentScope = new WalletScopeKey({
      address: currentAddress,
      network: "solana",
    });
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(
      new ClassicTransactionWorkflowKey({ ...key, walletScope: capturedScope })
    ).pipe(Atom.keepAlive);
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "caseSensitiveWalletWorkflowLifecycleAtom"
    );
    const app = await render(
      <RegistryProvider
        initialValues={[[currentWalletScopeAtom, currentScope]]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={lifecycleAtom}
                  workflowKeyAtom={inputAtom}
                />
              }
            >
              <Route path="steps" element={<div>unexpected</div>} />
            </Route>
            <Route
              path="/"
              element={<WorkflowInputProbe inputAtom={inputAtom} />}
            />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await expect
      .element(app.getByTestId("workflow-input"))
      .toHaveTextContent("missing");
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
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(key).pipe(
      Atom.keepAlive
    );
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "deferredSigningWorkflowLifecycleAtom"
    );
    const app = await render(
      <RegistryProvider
        initialValues={[
          [walletRuntime.layer, workflowLayer.pipe(Layer.fresh)],
          [currentWalletScopeAtom, walletScope],
        ]}
      >
        <MemoryRouter initialEntries={["/", "/steps"]} initialIndex={1}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={lifecycleAtom}
                  workflowKeyAtom={inputAtom}
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

    await expect.element(app.getByTestId("state")).toHaveTextContent("Signing");
    expect(signTransaction).toHaveBeenCalledOnce();
    await app.getByRole("button", { name: "Leave workflow" }).click();
    await expect.element(app.getByTestId("home")).toHaveTextContent("home");
    await Effect.runPromise(Deferred.await(signingInterrupted));

    expect(submitClassicSigned).not.toHaveBeenCalled();
    expect(signTransaction).toHaveBeenCalledOnce();

    app.unmount();
  });

  it("interrupts deferred confirmation and cannot restart after forward navigation", async () => {
    const confirmation = await Effect.runPromise(
      Deferred.make<{ explorerUrl: string; status: string }>()
    );
    const confirmationInterrupted = await Effect.runPromise(
      Deferred.make<void>()
    );
    const twoTransactionKey = new ClassicTransactionWorkflowKey({
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
    const inputAtom = Atom.make<ClassicTransactionWorkflowKey | null>(
      twoTransactionKey
    ).pipe(Atom.keepAlive);
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      inputAtom,
      "deferredConfirmationWorkflowLifecycleAtom"
    );
    const app = await render(
      <RegistryProvider
        initialValues={[
          [walletRuntime.layer, workflowLayer.pipe(Layer.fresh)],
          [currentWalletScopeAtom, walletScope],
        ]}
      >
        <MemoryRouter initialEntries={["/", "/steps"]} initialIndex={1}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
                  workflowLifecycleAtom={lifecycleAtom}
                  workflowKeyAtom={inputAtom}
                />
              }
            >
              <Route path="steps" element={<WorkflowProbe />} />
            </Route>
            <Route
              path="/"
              element={
                <div data-testid="home">
                  home
                  <ForwardNavigation />
                </div>
              }
            />
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
    await Effect.runPromise(
      Deferred.succeed(confirmation, {
        explorerUrl: "https://explorer.test/tx",
        status: "CONFIRMED",
      })
    );
    await app.getByRole("button", { name: "Go forward" }).click();
    await expect.element(app.getByTestId("home")).toHaveTextContent("home");
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(submitClassicSigned).toHaveBeenCalledOnce();
    expect(getClassicStatus).toHaveBeenCalledOnce();

    app.unmount();
  });
});
