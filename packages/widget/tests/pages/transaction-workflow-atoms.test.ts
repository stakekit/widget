import { Effect, Layer, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { makeTransactionWorkflowModule } from "../../src/features/transaction-workflow/state";
import type { ActionMeta } from "../../src/public-api/types";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { ClassicTransactionWorkflowInput } from "../../src/services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import { yieldApiTransactionFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const actionMeta = {
  actionId: "action-1",
  address,
} as unknown as ActionMeta;
const transaction = yieldApiTransactionFixture({
  id: "tx-1",
  network: "ethereum",
  status: "CREATED",
  unsignedTransaction: "unsigned",
}) as ActionTransaction;
const makeInput = () =>
  new ClassicTransactionWorkflowInput({
    actionMeta,
    transactions: [transaction],
    walletScope,
    yieldId,
  });

describe("transaction workflow module", () => {
  it("creates a fresh atom graph for every equal execution input", () => {
    const first = makeTransactionWorkflowModule(makeInput());
    const second = makeTransactionWorkflowModule(makeInput());

    expect(first).not.toBe(second);
  });

  it("disposes the machine with its scope while capabilities remain mounted", async () => {
    const probe = { disposed: 0, started: 0 };
    const workflowLayer = Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              probe.started += 1;
              return {
                dispatch: () => Effect.void,
                events: Stream.never,
                states: Stream.never,
              };
            }),
            () =>
              Effect.sync(() => {
                probe.disposed += 1;
              })
          ),
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [[walletRuntime.layer, workflowLayer]],
    });
    const firstAtom = makeTransactionWorkflowModule(makeInput());
    const secondAtom = makeTransactionWorkflowModule(makeInput());

    const disposeFirstScope = registry.mount(firstAtom);
    const first = registry.get(firstAtom);
    const disposeFirstState = registry.mount(first.stateAtom);
    const disposeSecondScope = registry.mount(secondAtom);
    const second = registry.get(secondAtom);
    const disposeSecondEvents = registry.mount(second.eventsAtom);
    await vi.waitFor(() => expect(probe.started).toBe(2));

    disposeFirstScope();
    disposeSecondScope();
    await vi.waitFor(() => expect(probe.disposed).toBe(2));

    registry.set(first.commandAtom, { _tag: "Retry" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(probe.disposed).toBe(2);
    expect(probe.started).toBe(2);

    disposeFirstState();
    disposeSecondEvents();
  });
});
