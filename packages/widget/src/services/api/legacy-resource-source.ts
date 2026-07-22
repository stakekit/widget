import { Context, Effect, Layer, Schema } from "effect";
import {
  type RewardsAddresses,
  RewardsSummaryRecord,
} from "../../domain/schema/dashboard-models";
import { EarnLegacyTokenOptionsResponse } from "../../domain/schema/earn-models";
import {
  type GasBalancesCommand,
  GasTokenBalancesResponse,
  type TokenBalanceScanCommand,
  TokenBalancesResponse,
} from "../../domain/schema/financial-models";
import {
  PriceRequest,
  PriceResponse,
} from "../../domain/schema/health-price-models";
import type { YieldId } from "../../domain/schema/identifiers";
import type { Network } from "../../domain/schema/network-model";
import { EnabledNetworksResponse } from "../../domain/schema/wallet-models";
import type * as LegacyApi from "../../generated/api/legacy";
import {
  decodeApiResponse,
  encodeApiRequest,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { ApiTransportService } from "./transport";

export const makeLegacyResourceSource = (legacyApi: LegacyApi.LegacyApi) => {
  const getEnabledNetworks = Effect.fn(
    "LegacyResourceSource.getEnabledNetworks"
  )(function* () {
    return yield* legacyApi
      .YieldControllerGetMyNetworks(undefined)
      .pipe(decodeApiResponse("enabled-networks", EnabledNetworksResponse));
  });

  const getPrices = Effect.fn("LegacyResourceSource.getPrices")(function* (
    request: PriceRequest
  ) {
    const payload = yield* encodeApiRequest(
      "token-prices-request",
      PriceRequest
    )(request);
    return yield* legacyApi
      .TokenControllerGetTokenPrices({ payload })
      .pipe(decodeApiResponse("token-prices", PriceResponse));
  });

  const getRewardsSummaries = Effect.fn(
    "LegacyResourceSource.getRewardsSummaries"
  )(function* (request: {
    readonly addresses: RewardsAddresses;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) {
    const responses = yield* Effect.forEach(
      request.yieldIds,
      (yieldId) =>
        legacyApi
          .YieldControllerGetSingleYieldRewardsSummary(yieldId, {
            payload: { addresses: request.addresses },
          })
          .pipe(
            withApiRequestError("yield-rewards-summary"),
            Effect.map((response) => [yieldId, response] as const)
          ),
      { concurrency: 5 }
    );

    return yield* Schema.decodeEffect(RewardsSummaryRecord)(
      Object.fromEntries(responses)
    ).pipe(withResponseDecodeError("yield-rewards-summary"));
  });

  const getGasTokenBalances = Effect.fn(
    "LegacyResourceSource.getGasTokenBalances"
  )(function* (command: GasBalancesCommand) {
    return yield* legacyApi
      .TokenControllerGetTokenBalances({ payload: command })
      .pipe(decodeApiResponse("gas-balance-check", GasTokenBalancesResponse));
  });

  const getTokenOptions = Effect.fn("LegacyResourceSource.getTokenOptions")(
    function* (network?: Network) {
      return yield* legacyApi
        .TokenControllerGetTokens({ params: { network } })
        .pipe(
          decodeApiResponse(
            "legacy-token-options",
            EarnLegacyTokenOptionsResponse
          )
        );
    }
  );

  const scanTokenBalances = Effect.fn("LegacyResourceSource.scanTokenBalances")(
    function* (command: TokenBalanceScanCommand) {
      return yield* legacyApi
        .TokenControllerTokenBalancesScan({ payload: command })
        .pipe(decodeApiResponse("token-balances-scan", TokenBalancesResponse));
    }
  );

  return {
    getEnabledNetworks,
    getGasTokenBalances,
    getPrices,
    getRewardsSummaries,
    getTokenOptions,
    scanTokenBalances,
  } as const;
};

export class LegacyResourceSource extends Context.Service<LegacyResourceSource>()(
  "stakekit/widget/services/api/LegacyResourceSource",
  {
    make: Effect.map(ApiTransportService, ({ legacy }) =>
      makeLegacyResourceSource(legacy)
    ),
  }
) {
  static readonly layer = Layer.effect(
    LegacyResourceSource,
    LegacyResourceSource.make
  );
}
