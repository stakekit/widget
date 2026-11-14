import { describe, expect, it, vi } from "@effect/vitest";
import { Context, Effect, Layer, Option, Schema } from "effect";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import { BorrowFeatureDisabled } from "../../../src/domain/borrow/availability";
import { ActionId as BorrowActionId } from "../../../src/domain/borrow/ids";
import {
  ActionId,
  TransactionHash,
  TransactionId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { BorrowApiError } from "../../../src/generated/api/borrow-client";
import { YieldApiError } from "../../../src/generated/api/yield";
import { makeBorrowOperations } from "../../../src/services/api/internal/borrow-operations";
import { makeBorrowResourceSource } from "../../../src/services/api/internal/borrow-resource-source";
import { makeYieldOperations } from "../../../src/services/api/internal/yield-operations";
import { makeYieldResourceSource } from "../../../src/services/api/internal/yield-resource-source";
import { BorrowOperations } from "../../../src/services/api/operations";
import {
  ApiRequestError,
  BorrowResourceSource,
  MissingBorrowApiConfig,
  ResponseDecodeError,
} from "../../../src/services/api/resource-sources";
import {
  confidentialFixture,
  yieldApiProviderFixture,
  yieldBalanceFixture,
} from "../../fixtures";
import { makeTestStakeKitApiLayer } from "../../utils/stakekit-api-layer";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: "https://yield.example.com",
};
const borrowActionId = Schema.decodeSync(BorrowActionId)("borrow-action");

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const firstYieldId = Schema.decodeSync(YieldId)("ethereum-eth-native-staking");
const transactionId = Schema.decodeSync(TransactionId)("transaction-1");

describe("application API services", () => {
  it.effect(
    "fails only Borrow capabilities when Borrow configuration is missing",
    () =>
      Effect.gen(function* () {
        const context = yield* Layer.build(
          makeTestStakeKitApiLayer({ ...config, borrowApiUrl: " " })
        ).pipe(Effect.scoped);
        const operations = Context.get(context, BorrowOperations);
        const source = Context.get(context, BorrowResourceSource);

        expect(yield* Effect.flip(source.getIntegrations)).toBeInstanceOf(
          MissingBorrowApiConfig
        );
        expect(
          yield* Effect.flip(operations.getAction(borrowActionId))
        ).toBeInstanceOf(MissingBorrowApiConfig);
      })
  );

  it.effect(
    "maps Borrow action polling through the narrow operation capability",
    () =>
      Effect.gen(function* () {
        const getAction = vi.fn(() => Effect.succeed(null));
        const operations = makeBorrowOperations(
          {
            read: { ActionsControllerGetActionV1: getAction },
            write: {},
          } as never,
          true,
          { present: () => Effect.void } as never
        );

        expect(yield* operations.getAction(borrowActionId)).toBe(null);
        expect(getAction).toHaveBeenCalledWith("borrow-action", undefined);
      })
  );

  it.effect("fails disabled Borrow commands before calling transport", () =>
    Effect.gen(function* () {
      const getAction = vi.fn();
      const operations = makeBorrowOperations(
        {
          read: { ActionsControllerGetActionV1: getAction },
          write: {},
        } as never,
        false,
        { present: () => Effect.void } as never
      );

      expect(
        yield* Effect.flip(operations.getAction(borrowActionId))
      ).toBeInstanceOf(BorrowFeatureDisabled);
      expect(getAction).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "presents a failed hash submission only when it is not in the background",
    () =>
      Effect.gen(function* () {
        const present = vi.fn(() => Effect.void);
        const operations = makeYieldOperations(
          {
            read: {},
            write: {
              TransactionsControllerSubmitTransactionHash: () =>
                Effect.fail(
                  BorrowApiError(
                    "400",
                    undefined,
                    HttpClientResponse.fromWeb(
                      HttpClientRequest.put("https://api.test/submit-hash"),
                      Response.json(
                        { message: "Transaction hash was rejected" },
                        { status: 400 }
                      )
                    )
                  )
                ),
            },
          } as never,
          { present } as never
        );
        const command = {
          payload: { hash: TransactionHash.make("0xhash") },
          transactionId,
        };

        yield* Effect.flip(
          operations.submitTransactionHashInBackground(command)
        );
        expect(present).not.toHaveBeenCalled();

        yield* Effect.flip(operations.submitTransactionHash(command));
        expect(present).toHaveBeenCalledTimes(1);
      })
  );

  it.effect(
    "decodes encrypted balances as hidden with zero amounts and their handle",
    () =>
      Effect.gen(function* () {
        const { cShare, cUsdc } = confidentialFixture;
        const handle = `0x${"aa".repeat(32)}`;
        const source = makeYieldResourceSource({
          YieldsControllerGetAggregateBalances: () =>
            Effect.succeed({
              errors: [],
              items: [
                {
                  balances: [
                    {
                      ...yieldBalanceFixture({ token: cUsdc }),
                      amount: "",
                      amountRaw: "",
                      isEncrypted: true,
                      shareAmount: "",
                      shareAmountRaw: handle,
                      shareToken: cShare,
                    },
                  ],
                  yieldId: firstYieldId,
                },
              ],
            }),
        } as never);

        const result = yield* source.getPositions({
          queries: [{ address, network: "ethereum" }],
        });
        const [hidden] = result.items[0]?.balances ?? [];

        expect(hidden).toMatchObject({
          isEncrypted: true,
          shares: { _tag: "Encrypted", handle },
        });
        expect(hidden?.amount.toFixed()).toBe("0");
      })
  );

  it.effect(
    "reads a provider page with its paging, leaving out an unreadable provider",
    () =>
      Effect.gen(function* () {
        const ProvidersControllerGetProviders = vi.fn(() =>
          Effect.succeed({
            items: [
              { ...yieldApiProviderFixture({ id: "lido" }), type: "protocol" },
              { id: "broken", type: "protocol" },
            ],
            limit: 100,
            offset: 100,
            total: 102,
          })
        );
        const source = makeYieldResourceSource({
          ProvidersControllerGetProviders,
        } as never);

        const page = yield* source.listProviders({ limit: 100, offset: 100 });

        expect(ProvidersControllerGetProviders).toHaveBeenCalledWith({
          params: { limit: 100, offset: 100 },
        });
        expect(page.items.map((provider) => provider.id)).toEqual(["lido"]);
        expect(page).toMatchObject({ limit: 100, offset: 100, total: 102 });
      })
  );

  const notFound = () =>
    HttpClientResponse.fromWeb(
      HttpClientRequest.get("https://api.test/missing"),
      new Response(null, { status: 404 })
    );
  const undeclaredNotFound = () =>
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({
        request: HttpClientRequest.get("https://api.test/missing"),
        response: notFound(),
      }),
    });
  const yieldNotFound = {
    declared: () => YieldApiError("404", undefined, notFound()),
    undeclared: undeclaredNotFound,
  };
  const borrowNotFound = {
    declared: () => BorrowApiError("404", undefined, notFound()),
    undeclared: undeclaredNotFound,
  };

  it.effect.each(
    (["declared", "undeclared"] as const).flatMap((spec) => [
      {
        read: "Yield Activity action",
        spec,
        isAbsent: Effect.gen(function* () {
          const source = makeYieldResourceSource({
            ActionsControllerGetAction: () =>
              Effect.fail(yieldNotFound[spec]()),
          } as never);
          return Option.isNone(
            yield* source.getActivityAction(
              yield* Schema.decodeEffect(ActionId)("missing-action")
            )
          );
        }),
      },
      {
        read: "rewards summary",
        spec,
        isAbsent: makeYieldResourceSource({
          YieldsControllerGetYieldRewardsSummary: () =>
            Effect.fail(yieldNotFound[spec]()),
        } as never)
          .getRewardsSummary({ address, yieldId: firstYieldId })
          .pipe(Effect.map(Option.isNone)),
      },
      {
        read: "Borrow action",
        spec,
        isAbsent: Effect.gen(function* () {
          const source = makeBorrowResourceSource(
            {
              ActionsControllerGetActionV1: () =>
                Effect.fail(borrowNotFound[spec]()),
            } as never,
            true
          );
          return Option.isNone(
            yield* source.getAction(
              yield* Schema.decodeEffect(BorrowActionId)("missing-action")
            )
          );
        }),
      },
    ])
  )("maps a $read 404 to explicit absence when $spec", ({ isAbsent }) =>
    Effect.gen(function* () {
      expect(yield* isAbsent).toBe(true);
    })
  );

  it.effect(
    "maps transport failures independently from response decoding failures",
    () =>
      Effect.gen(function* () {
        const transportFailureSource = makeYieldResourceSource({
          KycControllerGetStatus: () =>
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({
                  request: HttpClientRequest.get("https://api.example.test"),
                }),
              })
            ),
        } as never);
        const malformedResponseSource = makeYieldResourceSource({
          KycControllerGetStatus: () =>
            Effect.succeed({ kycStatus: "unexpected" }),
        } as never);

        const requestError = yield* transportFailureSource
          .getKycStatus({ address, yieldId: firstYieldId })
          .pipe(Effect.flip);
        const decodeError = yield* malformedResponseSource
          .getKycStatus({ address, yieldId: firstYieldId })
          .pipe(Effect.flip);

        expect(requestError).toBeInstanceOf(ApiRequestError);
        expect(requestError).toMatchObject({
          failure: { _tag: "Unreachable" },
          operation: "yield-kyc-status",
        });
        expect(decodeError).toBeInstanceOf(ResponseDecodeError);
        expect(decodeError.operation).toBe("yield-kyc-status");
      })
  );

  it.effect(
    "reads the wallet's rewards summary by address and decodes it",
    () =>
      Effect.gen(function* () {
        const window = (amount: string) => ({ amount, amountRaw: "0" });
        const getSummary = vi.fn(() =>
          Effect.succeed({
            yieldId: firstYieldId,
            address,
            token: { decimals: 18, network: "ethereum", symbol: "ETH" },
            last24H: window("0.01"),
            last7D: window("-0.5"),
            last30D: window("1"),
            lastYear: window("2"),
            total: window("3"),
          })
        );
        const source = makeYieldResourceSource({
          YieldsControllerGetYieldRewardsSummary: getSummary,
        } as never);

        const summary = yield* source.getRewardsSummary({
          address,
          yieldId: firstYieldId,
        });

        expect(getSummary).toHaveBeenCalledWith(firstYieldId, {
          params: { address },
        });
        expect(
          Option.map(summary, (value) => value.last7D.amount.toFixed())
        ).toEqual(Option.some("-0.5"));

        const malformed = yield* makeYieldResourceSource({
          YieldsControllerGetYieldRewardsSummary: () =>
            Effect.succeed({ token: { symbol: "ETH" } }),
        } as never)
          .getRewardsSummary({ address, yieldId: firstYieldId })
          .pipe(Effect.flip);

        expect(malformed).toBeInstanceOf(ResponseDecodeError);
        expect(malformed).toMatchObject({ operation: "yield-rewards-summary" });
      })
  );
});
