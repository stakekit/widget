import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber, Layer, Option, Schema, Stream } from "effect";
import type { TransactionType } from "../../../src/domain/action/rules";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { getYieldTransactionCompletionUrls } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import type { YieldOperations } from "../../../src/services/api/operations";
import { YieldTransactionWorkflowInput } from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import type { YieldActionMeta } from "../../../src/services/wallet/wallet-transactions";
import { yieldApiTransactionFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { makeTransactionWorkflowTestKit } from "../../utils/transaction-workflow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const yieldWalletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const actionMeta = {
  actionId: "yield-action-1",
  actionType: "stake",
  address,
  amount: "1",
  inputToken: undefined,
  providersDetails: [],
  yieldId,
} as unknown as YieldActionMeta;

const runYieldToCompletion = (
  transactionId: string,
  yieldOperations: Partial<YieldOperations["Service"]>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const kit = yield* makeTransactionWorkflowTestKit({
        initialWalletState: makeConnectedWalletState(yieldWalletScope),
        wallet: {
          signMessage: () => Effect.succeed("0xsigned"),
          signTransaction: () =>
            Effect.succeed({ broadcasted: false, signedTx: "0xsigned" }),
        },
        yieldOperations: {
          getTransactionStatus: () =>
            Effect.succeed({
              explorerUrl: null,
              status: "CONFIRMED",
            } as never),
          submitSignedTransaction: () =>
            Effect.succeed({
              explorerUrl: null,
              hash: null,
              status: "BROADCASTED",
            } as never),
          submitTransactionHash: () =>
            Effect.succeed({
              explorerUrl: null,
              hash: null,
              status: "BROADCASTED",
            } as never),
          ...yieldOperations,
        },
      });
      // The service outlives the workflow, as the Application Runtime
      // Generation does.
      const services = yield* Layer.build(kit.layer);
      const workflow = yield* TransactionWorkflowService.use(({ make }) =>
        make(
          new YieldTransactionWorkflowInput({
            actionMeta,
            transactions: [
              yieldApiTransactionFixture({
                id: transactionId,
                network: "ethereum",
                status: "CREATED",
                stepIndex: 0,
                unsignedTransaction: "unsigned-payload",
              }),
            ],
            walletScope: yieldWalletScope,
            yieldId,
          })
        )
      ).pipe(Effect.provide(services));
      const completed = yield* workflow.states.pipe(
        Stream.filter((state) => state._tag === "Completed"),
        Stream.runHead,
        Effect.forkChild
      );
      return Option.getOrThrow(yield* Fiber.join(completed));
    })
  );

describe("yield completion urls", () => {
  it.effect("includes confirmation explorerUrl in completion urls", () =>
    Effect.gen(function* () {
      const result = yield* runYieldToCompletion("tx-with-url", {
        getTransactionStatus: () =>
          Effect.succeed({
            explorerUrl: "https://explorer.test/from-status",
            status: "CONFIRMED",
          } as never),
      });

      expect(getYieldTransactionCompletionUrls(result.context)).toEqual([
        {
          type: "STAKE" satisfies TransactionType,
          url: "https://explorer.test/from-status",
        },
      ]);
    })
  );

  it.effect("keeps submit explorerUrl when status omits it", () =>
    Effect.gen(function* () {
      const submit = vi.fn(() =>
        Effect.succeed({
          explorerUrl: "https://explorer.test/from-submit",
          hash: null,
          status: "BROADCASTED",
        } as never)
      );

      const result = yield* runYieldToCompletion("tx-submit-url-only", {
        getTransactionStatus: () =>
          Effect.succeed({
            explorerUrl: null,
            status: "CONFIRMED",
          } as never),
        submitSignedTransaction: submit,
      });

      expect(getYieldTransactionCompletionUrls(result.context)).toEqual([
        {
          type: "STAKE" satisfies TransactionType,
          url: "https://explorer.test/from-submit",
        },
      ]);
      expect(submit).toHaveBeenCalled();
    })
  );
});
