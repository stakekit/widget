import { Context, Effect, Layer, Option, Schema } from "effect";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { describe, expect, it, vi } from "vitest";
import { YieldAction } from "../../src/domain/action/models";
import { BorrowFeatureDisabled } from "../../src/domain/borrow/availability";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import { RewardsAddresses } from "../../src/domain/portfolio/models";
import { makeBorrowOperations } from "../../src/services/api/borrow-operations";
import { makeBorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { makeLegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import {
  ApiRequestError,
  BorrowResourceSource,
  LegacyResourceSource,
  MissingBorrowApiConfig,
  ResponseDecodeError,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { makeYieldOperations } from "../../src/services/api/yield-operations";
import { makeYieldResourceSource } from "../../src/services/api/yield-resource-source";
import { WalletBootstrapSource } from "../../src/services/wallet/wallet-bootstrap-source";
import {
  yieldApiActionDtoFixture,
  yieldApiProviderFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { makeTestStakeKitApiLayer } from "../utils/stakekit-api-layer";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: "https://yield.example.com",
};

const address = Schema.decodeUnknownSync(WalletAddress)("0xWallet");
const firstYieldId = Schema.decodeUnknownSync(YieldId)(
  "ethereum-eth-native-staking"
);
const secondYieldId = Schema.decodeUnknownSync(YieldId)(
  "cosmos-atom-native-staking"
);

describe("application API services", () => {
  it("constructs separated Legacy, Yield, and Borrow operation surfaces", async () => {
    const context = await Effect.runPromise(
      Layer.build(makeTestStakeKitApiLayer(config)).pipe(Effect.scoped)
    );
    const borrowOperations = Context.get(context, BorrowOperations);
    const borrowSource = Context.get(context, BorrowResourceSource);
    const legacySource = Context.get(context, LegacyResourceSource);
    const yieldOperations = Context.get(context, YieldOperations);
    const yieldSource = Context.get(context, YieldResourceSource);
    const walletBootstrapSource = Context.get(context, WalletBootstrapSource);

    expect(legacySource.scanTokenBalances).toBeTypeOf("function");
    expect(legacySource.getPrices).toBeTypeOf("function");
    expect(legacySource.getRewardsSummaries).toBeTypeOf("function");
    expect(yieldOperations.previewAction).toBeTypeOf("function");
    expect(yieldSource.getPositions).toBeTypeOf("function");
    expect(yieldSource.getEnabledWalletNetworks).toBeTypeOf("function");
    expect(yieldSource.getHealth).toBeTypeOf("function");
    expect(yieldSource.getOpportunity).toBeTypeOf("function");
    expect(yieldSource.getProvider).toBeTypeOf("function");
    expect(yieldSource.listYields).toBeTypeOf("function");
    expect(walletBootstrapSource.getEnabledWalletNetworks).toBe(
      yieldSource.getEnabledWalletNetworks
    );
    expect(borrowOperations.executeAction).toBeTypeOf("function");
    expect(borrowSource.getMarkets).toBeTypeOf("function");
  });

  it("fails only Borrow capabilities when Borrow configuration is missing", async () => {
    const context = await Effect.runPromise(
      Layer.build(
        makeTestStakeKitApiLayer({ ...config, borrowApiUrl: " " })
      ).pipe(Effect.scoped)
    );
    const operations = Context.get(context, BorrowOperations);
    const source = Context.get(context, BorrowResourceSource);

    await expect(
      Effect.runPromise(source.getIntegrations())
    ).rejects.toBeInstanceOf(MissingBorrowApiConfig);
    await expect(
      Effect.runPromise(operations.getAction("borrow-action"))
    ).rejects.toBeInstanceOf(MissingBorrowApiConfig);
  });

  it("maps Borrow market reads through the narrow source capability", async () => {
    const markets = vi.fn(() =>
      Effect.succeed({ items: [], limit: 100, offset: 0, total: 0 })
    );
    const source = makeBorrowResourceSource(
      {
        MarketsControllerGetMarketsV1: markets,
      } as never,
      true
    );
    const request = {
      limit: 100,
      network: "ethereum" as const,
      offset: 0,
      scope: "all" as const,
    };

    expect(await Effect.runPromise(source.getMarkets(request))).toEqual({
      items: [],
      limit: 100,
      offset: 0,
      total: 0,
    });
    expect(markets).toHaveBeenCalledWith({ params: request });
  });

  it("maps Borrow action polling through the narrow operation capability", async () => {
    const getAction = vi.fn(() => Effect.succeed(null));
    const operations = makeBorrowOperations(
      {
        ActionsControllerGetActionV1: getAction,
      } as never,
      true,
      { present: () => Effect.void } as never
    );

    expect(await Effect.runPromise(operations.getAction("borrow-action"))).toBe(
      null
    );
    expect(getAction).toHaveBeenCalledWith("borrow-action", undefined);
  });

  it("fails disabled Borrow commands before calling transport", async () => {
    const getAction = vi.fn();
    const operations = makeBorrowOperations(
      {
        ActionsControllerGetActionV1: getAction,
      } as never,
      false,
      { present: () => Effect.void } as never
    );

    await expect(
      Effect.runPromise(operations.getAction("borrow-action"))
    ).rejects.toBeInstanceOf(BorrowFeatureDisabled);
    expect(getAction).not.toHaveBeenCalled();
  });

  it("returns decoded domain values from successful transport responses", async () => {
    const source = makeYieldResourceSource({
      KycControllerGetStatus: () => Effect.succeed({ kycStatus: "approved" }),
    } as never);

    const result = await Effect.runPromise(
      source.getKycStatus({ address, yieldId: firstYieldId })
    );

    expect(result).toEqual({ kycStatus: "approved" });
  });

  it("maps Health through the Yield read capability", async () => {
    const health = vi.fn(() =>
      Effect.succeed({
        status: "OK",
        timestamp: "1970-01-01T00:00:00.000Z",
      })
    );
    const source = makeYieldResourceSource({
      HealthControllerHealth: health,
    } as never);

    expect((await Effect.runPromise(source.getHealth())).status).toBe("OK");
    expect(health).toHaveBeenCalledWith(undefined);
  });

  it("maps Enabled Wallet Networks through the Yield read capability", async () => {
    const enabledNetworks = vi.fn(() =>
      Effect.succeed([{ id: "ethereum" }, { id: "plume" }, { id: "solana" }])
    );
    const source = makeYieldResourceSource({
      NetworksControllerGetNetworks: enabledNetworks,
    } as never);

    expect(await Effect.runPromise(source.getEnabledWalletNetworks())).toEqual(
      new Set(["ethereum", "solana"])
    );
    expect(enabledNetworks).toHaveBeenCalledWith(undefined);
  });

  it("maps Action Preview through the narrow Yield operation capability", async () => {
    const action = yieldApiActionDtoFixture();
    const expected = Schema.decodeUnknownSync(YieldAction)(action);
    const enter = vi.fn(() => Effect.succeed(action));
    const operations = makeYieldOperations(
      {
        ActionsControllerEnterYield: enter,
      } as never,
      { present: () => Effect.void } as never
    );
    const command = {
      address,
      arguments: { amount: "1" },
      yieldId: firstYieldId,
    };

    expect(
      await Effect.runPromise(
        operations.previewAction({ command, intent: "enter" })
      )
    ).toEqual(expected);
    expect(enter).toHaveBeenCalledWith({ payload: command });
  });

  it("maps Yield position requests through the narrow read capability", async () => {
    const aggregateBalances = vi.fn(() =>
      Effect.succeed({ errors: [], items: [] })
    );
    const source = makeYieldResourceSource({
      YieldsControllerGetAggregateBalances: aggregateBalances,
    } as never);
    const command = {
      queries: [{ address, network: "ethereum" as const }],
    };

    const result = await Effect.runPromise(source.getPositions(command));

    expect(result).toEqual({ errors: [], items: [] });
    expect(aggregateBalances).toHaveBeenCalledWith({ payload: command });
  });

  it("maps Yield directory filters through the narrow read capability", async () => {
    const list = vi.fn(() =>
      Effect.succeed({ items: [], limit: 100, offset: 0, total: 0 })
    );
    const source = makeYieldResourceSource({
      YieldsControllerGetYields: list,
    } as never);
    const request = {
      limit: 100,
      network: "ethereum" as const,
      offset: 0,
      types: ["staking" as const],
      yieldIds: [firstYieldId],
    };

    expect(await Effect.runPromise(source.listYields(request))).toEqual({
      items: [],
      limit: 100,
      offset: 0,
      total: 0,
    });
    expect(list).toHaveBeenCalledWith({ params: request });
  });

  it("maps the canonical Earn Catalog through the Legacy read capability", async () => {
    const legacyTokens = vi.fn(() => Effect.succeed([]));
    const legacySource = makeLegacyResourceSource({
      TokenControllerGetTokens: legacyTokens,
    } as never);

    await Effect.runPromise(
      legacySource.getTokenOptions({
        enter: true,
        network: "ethereum",
        yieldTypes: ["staking"],
      })
    );
    expect(legacyTokens).toHaveBeenCalledWith({
      params: {
        enter: true,
        network: "ethereum",
        yieldTypes: ["staking"],
      },
    });
  });

  it("maps complete validator query identity through the Yield read capability", async () => {
    const validators = vi.fn(() =>
      Effect.succeed({ items: [], limit: 100, offset: 0, total: 0 })
    );
    const source = makeYieldResourceSource({
      YieldsControllerGetYieldValidators: validators,
    } as never);
    const request = {
      address: "validator-address",
      limit: 100,
      name: "validator-name",
      offset: 0,
      preferred: false,
      status: "active" as const,
      yieldId: firstYieldId,
    };

    await Effect.runPromise(source.listValidators(request));

    expect(validators).toHaveBeenCalledWith(firstYieldId, {
      params: {
        address: "validator-address",
        limit: 100,
        name: "validator-name",
        offset: 0,
        preferred: false,
        status: "active",
      },
    });
  });

  it("maps Activity history query identity through the Yield read capability", async () => {
    const activity = vi.fn(() =>
      Effect.succeed({ items: [], limit: 50, offset: 0, total: 0 })
    );
    const source = makeYieldResourceSource({
      ActionsControllerGetActions: activity,
    } as never);
    const request = {
      address,
      limit: 50,
      network: "ethereum" as const,
      offset: 0,
      statuses: ["FAILED" as const, "SUCCESS" as const],
    };

    await Effect.runPromise(source.listActivity(request));

    expect(activity).toHaveBeenCalledWith({ params: request });
  });

  it("maps single-Yield and gas balances through narrow read capabilities", async () => {
    const singleBalances = vi.fn(() =>
      Effect.succeed({ balances: [], yieldId: firstYieldId })
    );
    const gasBalances = vi.fn(() => Effect.succeed([]));
    const yieldSource = makeYieldResourceSource({
      YieldsControllerGetYieldBalances: singleBalances,
    } as never);
    const legacySource = makeLegacyResourceSource({
      TokenControllerGetTokenBalances: gasBalances,
    } as never);
    const gasCommand = {
      addresses: [{ address, network: "ethereum" as const }],
    };

    await Effect.runPromise(
      yieldSource.getSingleYieldBalances({
        address,
        yieldId: firstYieldId,
      })
    );
    await Effect.runPromise(legacySource.getGasTokenBalances(gasCommand));

    expect(singleBalances).toHaveBeenCalledWith(firstYieldId, {
      payload: { address },
    });
    expect(gasBalances).toHaveBeenCalledWith({ payload: gasCommand });
  });

  it("maps price requests through the Legacy read capability", async () => {
    const prices = vi.fn(() => Effect.succeed({}));
    const source = makeLegacyResourceSource({
      TokenControllerGetTokenPrices: prices,
    } as never);
    const token = yieldApiYieldFixture().token;
    const request = { currency: "USD", tokenList: [token] };

    await Effect.runPromise(source.getPrices(request));

    expect(prices).toHaveBeenCalledWith({ payload: request });
  });

  it("maps Yield history identity through the Yield read capability", async () => {
    const rewardHistory = vi.fn(() => Effect.succeed({}));
    const tvlHistory = vi.fn(() => Effect.succeed({}));
    const source = makeYieldResourceSource({
      YieldsControllerGetYieldRewardRateHistory: rewardHistory,
      YieldsControllerGetYieldTvlHistory: tvlHistory,
    } as never);
    const request = {
      interval: "week" as const,
      period: "1y" as const,
      yieldId: firstYieldId,
    };

    await Effect.runPromise(
      source.getRewardRateHistory(request).pipe(Effect.flip)
    );
    await Effect.runPromise(source.getTvlHistory(request).pipe(Effect.flip));

    expect(rewardHistory).toHaveBeenCalledWith(firstYieldId, {
      params: { interval: "week", period: "1y" },
    });
    expect(tvlHistory).toHaveBeenCalledWith(firstYieldId, {
      params: { interval: "week", period: "1y" },
    });
  });

  it("maps opportunity and provider lookups through the narrow read capability", async () => {
    const yieldDto = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture(yieldDto);
    const provider = yieldApiProviderFixture({ id: yieldModel.providerId });
    const getYield = vi.fn(() => Effect.succeed(yieldDto));
    const getProvider = vi.fn(() => Effect.succeed(provider));
    const source = makeYieldResourceSource({
      ProvidersControllerGetProvider: getProvider,
      YieldsControllerGetYield: getYield,
    } as never);

    expect(
      await Effect.runPromise(source.getOpportunity(yieldModel.id))
    ).toEqual(yieldModel);
    expect(await Effect.runPromise(source.getProvider(provider.id))).toEqual(
      Option.some(provider)
    );
    expect(getYield).toHaveBeenCalledWith(yieldModel.id, undefined);
    expect(getProvider).toHaveBeenCalledWith(provider.id, undefined);
  });

  it("reports invalid consumed opportunity arguments as response decode errors", async () => {
    const valid = yieldApiYieldDtoFixture();
    const getYield = vi.fn(() =>
      Effect.succeed({
        ...valid,
        mechanics: {
          ...valid.mechanics,
          arguments: {
            enter: {
              fields: [
                {
                  label: "Amount",
                  minimum: "not-a-number",
                  name: "amount",
                  type: "string",
                },
              ],
            },
          },
        },
      })
    );
    const source = makeYieldResourceSource({
      YieldsControllerGetYield: getYield,
    } as never);

    await expect(
      Effect.runPromise(source.getOpportunity(firstYieldId))
    ).rejects.toBeInstanceOf(ResponseDecodeError);
  });

  it("maps a provider 404 to explicit absence at the source boundary", async () => {
    const provider = yieldApiProviderFixture();
    const getProvider = vi.fn(() =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.StatusCodeError({
            request: {} as never,
            response: { status: 404 } as never,
          }),
        })
      )
    );
    const source = makeYieldResourceSource({
      ProvidersControllerGetProvider: getProvider,
    } as never);

    expect(
      Option.isNone(await Effect.runPromise(source.getProvider(provider.id)))
    ).toBe(true);
  });

  it("maps token balance scans through the narrow Legacy read capability", async () => {
    const scan = vi.fn(() => Effect.succeed([]));
    const source = makeLegacyResourceSource({
      TokenControllerTokenBalancesScan: scan,
    } as never);
    const command = {
      addresses: { address },
      network: "ethereum" as const,
    };

    expect(await Effect.runPromise(source.scanTokenBalances(command))).toEqual(
      []
    );
    expect(scan).toHaveBeenCalledWith({ payload: command });
  });

  it("maps transport failures independently from response decoding failures", async () => {
    const transportFailureSource = makeYieldResourceSource({
      KycControllerGetStatus: () => Effect.fail(new Error("offline")),
    } as never);
    const malformedResponseSource = makeYieldResourceSource({
      KycControllerGetStatus: () => Effect.succeed({ kycStatus: "unexpected" }),
    } as never);

    const requestError = await Effect.runPromise(
      transportFailureSource
        .getKycStatus({ address, yieldId: firstYieldId })
        .pipe(Effect.flip)
    );
    const decodeError = await Effect.runPromise(
      malformedResponseSource
        .getKycStatus({ address, yieldId: firstYieldId })
        .pipe(Effect.flip)
    );

    expect(requestError).toBeInstanceOf(ApiRequestError);
    expect(requestError.operation).toBe("yield-kyc-status");
    expect(decodeError).toBeInstanceOf(ResponseDecodeError);
    expect(decodeError.operation).toBe("yield-kyc-status");
  });

  it("retains valid aggregate entries when a sibling response is malformed", async () => {
    const rewards = {
      last24H: "0",
      last30D: "3",
      last7D: "1",
      lastYear: "12",
      total: "20",
    };
    const token = {
      decimals: 18,
      name: "Ethereum",
      network: "ethereum",
      symbol: "ETH",
    };
    const source = makeLegacyResourceSource({
      YieldControllerGetSingleYieldRewardsSummary: (yieldId: string) =>
        Effect.succeed(
          yieldId === firstYieldId
            ? { rewards, token }
            : { rewards, token: { ...token, decimals: "invalid" } }
        ),
    } as never);
    const addresses = Schema.decodeUnknownSync(RewardsAddresses)({ address });

    const result = await Effect.runPromise(
      source.getRewardsSummaries({
        addresses,
        yieldIds: [firstYieldId, secondYieldId],
      })
    );

    expect(Object.keys(result)).toEqual([firstYieldId]);
  });
});
