import { Context, Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ApiRequestError,
  MissingBorrowApiConfig,
  ResponseDecodeError,
} from "../../src/domain/schema/api-errors";
import { RewardsAddresses } from "../../src/domain/schema/dashboard-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { StakeKitApiService } from "../../src/providers/api/api-service";
import { makeLegacyApiService } from "../../src/providers/api/legacy-api-service";
import { makeYieldApiService } from "../../src/providers/api/yield-api-service";
import { makeTestStakeKitApiLayer } from "../utils/stakekit-api-layer";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: "https://yield.example.com",
};

const makeYieldApiWithTransport = (transport: { readonly yield: object }) =>
  makeYieldApiService(transport.yield as never);

const makeLegacyApiWithTransport = (transport: { readonly legacy: object }) =>
  makeLegacyApiService(transport.legacy as never);

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
    const api = Context.get(context, StakeKitApiService);

    expect(api.legacy.getPrices).toBeTypeOf("function");
    expect(api.legacy).not.toHaveProperty("getYields");
    expect(api.yield.getYields).toBeTypeOf("function");
    expect(api.yield).not.toHaveProperty("getPrices");
    expect(api.borrow.getMarkets).toBeTypeOf("function");
    expect(api.borrow).not.toHaveProperty("getYields");
  });

  it("fails only Borrow operations when Borrow configuration is missing", async () => {
    const context = await Effect.runPromise(
      Layer.build(
        makeTestStakeKitApiLayer({ ...config, borrowApiUrl: " " })
      ).pipe(Effect.scoped)
    );
    const api = Context.get(context, StakeKitApiService);

    await expect(
      Effect.runPromise(api.borrow.getIntegrations())
    ).rejects.toBeInstanceOf(MissingBorrowApiConfig);
  });

  it("returns decoded domain values from successful transport responses", async () => {
    const api = makeYieldApiWithTransport({
      yield: {
        KycControllerGetStatus: () => Effect.succeed({ kycStatus: "approved" }),
      },
    });

    const result = await Effect.runPromise(
      api.getKycStatus({ address, yieldId: firstYieldId })
    );

    expect(result).toEqual({ kycStatus: "approved" });
  });

  it("maps transport failures independently from response decoding failures", async () => {
    const transportFailureApi = makeYieldApiWithTransport({
      yield: {
        KycControllerGetStatus: () => Effect.fail(new Error("offline")),
      },
    });
    const malformedResponseApi = makeYieldApiWithTransport({
      yield: {
        KycControllerGetStatus: () =>
          Effect.succeed({ kycStatus: "unexpected" }),
      },
    });

    const requestError = await Effect.runPromise(
      transportFailureApi
        .getKycStatus({ address, yieldId: firstYieldId })
        .pipe(Effect.flip)
    );
    const decodeError = await Effect.runPromise(
      malformedResponseApi
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
    const api = makeLegacyApiWithTransport({
      legacy: {
        YieldControllerGetSingleYieldRewardsSummary: (yieldId: string) =>
          Effect.succeed(
            yieldId === firstYieldId
              ? { rewards, token }
              : { rewards, token: { ...token, decimals: "invalid" } }
          ),
      },
    });
    const addresses = Schema.decodeUnknownSync(RewardsAddresses)({ address });

    const result = await Effect.runPromise(
      api.getRewardsSummaries({
        addresses,
        yieldIds: [firstYieldId, secondYieldId],
      })
    );

    expect(Object.keys(result)).toEqual([firstYieldId]);
  });
});
