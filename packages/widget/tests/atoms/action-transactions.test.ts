import { Cause, Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  ActionCommand,
  YieldAction,
} from "../../src/domain/schema/action-models";
import {
  ActionPreviewKey,
  actionPreviewAtom,
} from "../../src/hooks/api/action-atoms";
import { StakeKitApiService } from "../../src/providers/api/api-service";
import {
  type ActionPreviewRequest,
  makeYieldApiService,
} from "../../src/providers/api/yield-api-service";
import { widgetAtomRuntime } from "../../src/providers/effect-atom-runtime/widget-runtime";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";

const transaction = yieldApiTransactionFixture({
  id: "transaction-1",
  network: "ethereum",
});
const action = Schema.decodeUnknownSync(YieldAction)(
  yieldApiActionFixture({
    address: "0xWallet",
    id: "action-1",
    transactions: [transaction],
    yieldId: "ethereum-eth-native-staking",
  })
);

const makeRegistry = (api: object) => {
  const apiLayer = Layer.succeed(StakeKitApiService, { yield: api } as never);

  return AtomRegistry.make({
    initialValues: [[widgetAtomRuntime.layer, apiLayer.pipe(Layer.fresh)]],
  });
};

describe("action and transaction atoms", () => {
  it("publishes domain action previews returned by the API service", () => {
    const previewAction = vi.fn(() => Effect.succeed(action));
    const registry = makeRegistry({
      previewAction,
    });
    const command = Schema.decodeUnknownSync(ActionCommand)({
      address: "0xWallet",
      yieldId: "ethereum-eth-native-staking",
    });
    const request: ActionPreviewRequest = { command, intent: "enter" };
    const resource = actionPreviewAtom(
      new ActionPreviewKey({ enabled: true, request })
    );

    const result = registry.get(resource);

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result) && result.value) {
      expect(result.value.id).toBe("action-1");
    }
    expect(previewAction).toHaveBeenCalledOnce();
  });

  it("reports malformed atom input as input validation, not response decoding", () => {
    const enter = vi.fn();
    const registry = makeRegistry(
      makeYieldApiService({ ActionsControllerEnterYield: enter } as never)
    );
    const request = {
      command: { address: "0xWallet" },
      intent: "enter",
    } as unknown as ActionPreviewRequest;
    const resource = actionPreviewAtom(
      new ActionPreviewKey({
        enabled: true,
        request,
      })
    );

    const result = registry.get(resource);

    expect(AsyncResult.isFailure(result)).toBe(true);
    if (AsyncResult.isFailure(result)) {
      const error = Cause.findErrorOption(result.cause);

      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error) && "_tag" in error.value) {
        expect(error.value._tag).toBe("InputValidationError");
      }
    }
    expect(enter).not.toHaveBeenCalled();
  });
});
