import { RegistryProvider } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ClassicTransactionWorkflowGuard } from "../../src/app/routes/guards/classic-transaction-workflow";
import { appRuntime } from "../../src/app/runtime";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { useTransactionWorkflow } from "../../src/features/transaction-flow/ui/steps/hooks/use-transaction-workflow.hook";
import type { ActionMeta } from "../../src/public-api/types";
import { ClassicTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../../src/services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import { yieldApiTransactionFixture } from "../fixtures";
import { render } from "../utils/test-utils";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
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
  yieldId,
});
const workflowKeyAtom = Atom.make<ClassicTransactionWorkflowKey | null>(key);
const missingWorkflowKeyAtom = Atom.make<ClassicTransactionWorkflowKey | null>(
  null
);

const WorkflowProbe = () => {
  const { state } = useTransactionWorkflow();

  return <div data-testid="state">{state._tag}</div>;
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
      getBorrowAction: () => Effect.die("unexpected borrow status"),
      getClassicStatus: () =>
        Effect.succeed({
          explorerUrl: "https://explorer.test/tx",
          status: "CONFIRMED" as const,
        }),
      getWalletState: () => ({
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
      trackEvent: () => Effect.void,
    } as unknown as TransactionWorkflowOperationsService["Service"];
    const workflowLayer = TransactionWorkflowService.layer.pipe(
      Layer.provide(
        Layer.succeed(TransactionWorkflowOperationsService, operations)
      )
    );
    const app = await render(
      <RegistryProvider
        initialValues={[[appRuntime.layer, workflowLayer.pipe(Layer.fresh)]]}
      >
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
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
      <RegistryProvider>
        <MemoryRouter initialEntries={["/steps"]}>
          <Routes>
            <Route
              element={
                <ClassicTransactionWorkflowGuard
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
});
