import { Effect, Layer, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import {
  makeClassicTransactionWorkflowModule,
  transactionWorkflowDispatchAtom,
  transactionWorkflowMachineAtom,
  transactionWorkflowStateAtom,
} from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import type { ActionMeta } from "../../src/public-api/types";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { ClassicTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
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

describe("transaction workflow atoms", () => {
  it("returns one atom graph for value-equal workflow keys", () => {
    const makeKey = () =>
      new ClassicTransactionWorkflowKey({
        actionMeta,
        transactions: [transaction],
        walletScope,
        yieldId,
      });

    expect(transactionWorkflowMachineAtom(makeKey())).toBe(
      transactionWorkflowMachineAtom(makeKey())
    );
    expect(transactionWorkflowStateAtom(makeKey())).toBe(
      transactionWorkflowStateAtom(makeKey())
    );
    expect(transactionWorkflowDispatchAtom(makeKey())).toBe(
      transactionWorkflowDispatchAtom(makeKey())
    );
  });

  it("creates isolated machines for equal keys owned by different sessions", async () => {
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
    const key = new ClassicTransactionWorkflowKey({
      actionMeta,
      transactions: [transaction],
      walletScope,
      yieldId,
    });
    const first = makeClassicTransactionWorkflowModule(key);
    const second = makeClassicTransactionWorkflowModule(key);

    const disposeFirst = registry.mount(first.viewAtom);
    const disposeSecond = registry.mount(second.viewAtom);
    await vi.waitFor(() => expect(probe.started).toBe(2));

    disposeFirst();
    disposeSecond();
    await vi.waitFor(() => expect(probe.disposed).toBe(2));
  });
});
