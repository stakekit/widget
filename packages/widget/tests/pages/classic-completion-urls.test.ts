import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber, Option, Schema, Stream } from "effect";
import type { TransactionType } from "../../src/domain/action/rules";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { getClassicTransactionCompletionUrls } from "../../src/features/classic-transaction-flow/model/classic-transaction-workflow";
import type { ActionMeta } from "../../src/public-api/types";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { ClassicTransactionWorkflowInput } from "../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiTransactionFixture } from "../fixtures";
import { makeTransactionWorkflowTestLayer } from "../utils/transaction-workflow-layer";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const classicWalletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const actionMeta = {
  actionId: "classic-action-1",
  actionType: "stake",
  address,
  amount: "1",
  inputToken: undefined,
  providersDetails: [],
  yieldId,
} as unknown as ActionMeta;

const runClassicToCompletion = (
  transactionId: string,
  yieldOperations: Partial<YieldOperations["Service"]>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const workflow = yield* TransactionWorkflowService.use(({ make }) =>
        make(
          new ClassicTransactionWorkflowInput({
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
            walletScope: classicWalletScope,
            yieldId,
          })
        )
      );
      const completed = yield* workflow.states.pipe(
        Stream.filter((state) => state._tag === "Completed"),
        Stream.runHead,
        Effect.forkChild
      );
      return Option.getOrThrow(yield* Fiber.join(completed));
    })
  ).pipe(
    Effect.provide(
      makeTransactionWorkflowTestLayer({
        borrow: BorrowOperations.of({
          getAction: () => Effect.succeed(null),
          stepAction: () => Effect.die("unexpected"),
          submitTransaction: () => Effect.die("unexpected"),
        } as never),
        tracking: TrackingService.of({
          trackEvent: () => Effect.void,
          trackPageView: () => Effect.void,
        } as never),
        wallet: WalletService.of({
          state: Effect.succeed({
            connection: {
              address,
              network: "ethereum",
              status: "connected",
            },
            ledger: { accounts: [], appName: null },
          } as never),
          signMessage: () => Effect.succeed("0xsigned"),
          signTransaction: () =>
            Effect.succeed({ broadcasted: false, signedTx: "0xsigned" }),
        } as never),
        yieldOperations: YieldOperations.of({
          getTransactionStatus: () =>
            Effect.succeed({
              explorerUrl: null,
              status: "CONFIRMED",
            } as never),
          previewAction: () => Effect.die("unexpected"),
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
        } as never),
      })
    )
  );

describe("classic completion urls", () => {
  it.effect("includes confirmation explorerUrl in completion urls", () =>
    Effect.gen(function* () {
      const result = yield* runClassicToCompletion("tx-with-url", {
        getTransactionStatus: () =>
          Effect.succeed({
            explorerUrl: "https://explorer.test/from-status",
            status: "CONFIRMED",
          } as never),
      });

      expect(getClassicTransactionCompletionUrls(result.context)).toEqual([
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

      const result = yield* runClassicToCompletion("tx-submit-url-only", {
        getTransactionStatus: () =>
          Effect.succeed({
            explorerUrl: null,
            status: "CONFIRMED",
          } as never),
        submitSignedTransaction: submit,
      });

      expect(getClassicTransactionCompletionUrls(result.context)).toEqual([
        {
          type: "STAKE" satisfies TransactionType,
          url: "https://explorer.test/from-submit",
        },
      ]);
      expect(submit).toHaveBeenCalled();
    })
  );
});
