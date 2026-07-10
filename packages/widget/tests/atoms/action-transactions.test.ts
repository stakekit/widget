import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  ActionCommand,
  SubmitSignedTransactionCommand,
} from "../../src/domain/schema/action-models";
import {
  ActionPreviewKey,
  type ActionRequest,
  actionPreviewAtom,
} from "../../src/hooks/api/action-atoms";
import { submitSignedTransactionAtom } from "../../src/hooks/api/transaction-atoms";
import { StakeKitApiService } from "../../src/providers/api/api-client";
import { stakeKitApiLayerAtom } from "../../src/providers/effect-atom-runtime/stakekit-api-service";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";

const transaction = yieldApiTransactionFixture({
  id: "transaction-1",
  network: "ethereum",
});
const action = yieldApiActionFixture({
  address: "0xWallet",
  id: "action-1",
  transactions: [transaction],
  yieldId: "ethereum-eth-native-staking",
});

const makeRegistry = (api: object) =>
  AtomRegistry.make({
    initialValues: [
      [stakeKitApiLayerAtom, Layer.succeed(StakeKitApiService, api as never)],
    ],
  });

describe("action and transaction atoms", () => {
  it("strictly decodes action previews", () => {
    const enter = vi.fn(() => Effect.succeed(action));
    const registry = makeRegistry({
      yieldMutations: {
        ActionsControllerEnterYield: enter,
      },
    });
    const command = Schema.decodeUnknownSync(ActionCommand)({
      address: "0xWallet",
      yieldId: "ethereum-eth-native-staking",
    });
    const request: ActionRequest = { command, intent: "enter" };
    const resource = actionPreviewAtom(
      new ActionPreviewKey({ decodeIssue: null, enabled: true, request })
    );

    const result = registry.get(resource);

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result) && result.value) {
      expect(result.value.id).toBe("action-1");
    }
    expect(enter).toHaveBeenCalledOnce();
  });

  it("runs a transaction submission once and rejects malformed singles", () => {
    let attempts = 0;
    const api = {
      yieldMutations: {
        TransactionsControllerSubmitTransaction: () => {
          attempts += 1;
          return Effect.succeed({ ...transaction, id: "" });
        },
      },
    };
    const registry = makeRegistry(api);
    const command = Schema.decodeUnknownSync(SubmitSignedTransactionCommand)({
      payload: { signedTransaction: "signed" },
      transactionId: "transaction-1",
    });

    registry.set(submitSignedTransactionAtom, command);
    const result = registry.get(submitSignedTransactionAtom);

    expect(AsyncResult.isFailure(result)).toBe(true);
    expect(attempts).toBe(1);
  });
});
