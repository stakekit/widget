import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { TransactionId as BorrowTransactionId } from "../../../src/domain/borrow/ids";
import {
  TransactionId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import {
  BorrowOperations,
  YieldOperations,
} from "../../../src/services/api/operations";
import {
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../../fixtures";
import { makeTestStakeKitApiLayer } from "../../utils/stakekit-api-layer";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: "https://yield.example.com",
};

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const yieldId = Schema.decodeSync(YieldId)("ethereum-eth-native-staking");
const transactionId = Schema.decodeSync(TransactionId)("transaction-1");
const borrowTransactionId = Schema.decodeSync(BorrowTransactionId)(
  "borrow-transaction-1"
);

type ApiContext = Context.Context<
  | BorrowOperations
  | LegacyResourceSource
  | YieldOperations
  | YieldResourceSource
>;

type ApiCall = {
  readonly name: string;
  readonly run: (context: ApiContext) => Effect.Effect<unknown, unknown>;
};

const writes: ReadonlyArray<ApiCall> = [
  {
    name: "Yield enter Action Preview",
    run: (context) =>
      Context.get(context, YieldOperations).previewAction({
        command: { address, arguments: { amount: "1" }, yieldId },
        intent: "enter",
      }),
  },
  {
    name: "Yield exit Action Preview",
    run: (context) =>
      Context.get(context, YieldOperations).previewAction({
        command: { address, arguments: { amount: "1" }, yieldId },
        intent: "exit",
      }),
  },
  {
    name: "Yield manage Action Preview",
    run: (context) =>
      Context.get(context, YieldOperations).previewAction({
        command: {
          action: "CLAIM_REWARDS",
          address,
          passthrough: "passthrough",
          yieldId,
        },
        intent: "manage",
      }),
  },
  {
    name: "transaction hash submission",
    run: (context) =>
      Context.get(context, YieldOperations).submitTransactionHash({
        payload: { hash: "0xhash" },
        transactionId,
      }),
  },
  {
    name: "signed transaction submission",
    run: (context) =>
      Context.get(context, YieldOperations).submitSignedTransaction({
        payload: { signedTransaction: "0xsigned" },
        transactionId,
      }),
  },
  {
    name: "Borrow action execution",
    run: (context) =>
      Context.get(context, BorrowOperations).executeAction({
        action: "supply",
        address,
        args: { amount: "1", marketId: "market-1" },
        integrationId: "integration-1",
      } as never),
  },
  {
    name: "Borrow action step",
    run: (context) =>
      Context.get(context, BorrowOperations).stepAction("borrow-action"),
  },
  {
    name: "Borrow transaction submission",
    run: (context) =>
      Context.get(context, BorrowOperations).submitTransaction({
        command: { signedTransaction: "0xsigned" } as never,
        transactionId: borrowTransactionId,
      }),
  },
];

const reads: ReadonlyArray<ApiCall> = [
  {
    name: "Health read",
    run: (context) => Context.get(context, YieldResourceSource).getHealth,
  },
  {
    name: "POST-shaped token price read",
    run: (context) =>
      Context.get(context, LegacyResourceSource).getPrices({
        currency: "USD",
        tokenList: [yieldApiYieldFixture().token],
      }),
  },
  {
    name: "POST-shaped aggregate yield balance read",
    run: (context) =>
      Context.get(context, YieldResourceSource).getPositions({
        queries: [{ address, network: "ethereum" }],
      }),
  },
  {
    name: "transaction status read",
    run: (context) =>
      Context.get(context, YieldOperations).getTransactionStatus({
        transactionId,
      }),
  },
  {
    name: "Borrow action lookup",
    run: (context) =>
      Context.get(context, BorrowOperations).getAction("borrow-action"),
  },
];

type Failure = {
  readonly name: string;
  readonly respond: () => Promise<Response>;
};

const failures: ReadonlyArray<Failure> = [
  {
    name: "a transport error",
    respond: () => Promise.reject(new TypeError("Failed to fetch")),
  },
  {
    name: "a timeout",
    respond: () =>
      Promise.reject(new DOMException("signal timed out", "TimeoutError")),
  },
  {
    name: "a 503",
    respond: () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "unavailable" }), {
          headers: { "content-type": "application/json" },
          status: 503,
        })
      ),
  },
];

const countRequests = (call: ApiCall, failure: Failure) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(makeTestStakeKitApiLayer(config));
    let requests = 0;
    const fetch: typeof globalThis.fetch = () => {
      requests += 1;
      return failure.respond();
    };

    yield* call
      .run(context)
      .pipe(Effect.flip, Effect.provideService(FetchHttpClient.Fetch, fetch));

    return requests;
  }).pipe(Effect.scoped);

describe("API transport retries", () => {
  for (const failure of failures) {
    for (const write of writes) {
      it.effect(`sends ${write.name} once on ${failure.name}`, () =>
        Effect.gen(function* () {
          expect(yield* countRequests(write, failure)).toBe(1);
        })
      );
    }

    for (const read of reads) {
      it.effect(`retries ${read.name} on ${failure.name}`, () =>
        Effect.gen(function* () {
          expect(yield* countRequests(read, failure)).toBe(4);
        })
      );
    }
  }
});
