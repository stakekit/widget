import { Context, Effect, Layer, Schema } from "effect";
import { EarnLegacyTokenOptionsResponse } from "../../domain/earn/models";
import type { KnownApiYieldType } from "../../domain/earn/yield";
import {
  type GasBalancesCommand,
  GasTokenBalancesResponse,
  type TokenBalanceScanCommand,
  TokenBalancesResponse,
} from "../../domain/finance/models";
import { PriceRequest, PriceResponse } from "../../domain/health/models";
import type { YieldId } from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import {
  type RewardsAddresses,
  RewardsSummaryRecord,
} from "../../domain/portfolio/models";
import { EnabledNetworksResponse } from "../../domain/wallet/models";
import type * as LegacyApi from "../../generated/api/legacy";
import {
  decodeApiResponse,
  encodeApiRequest,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { ApiTransportService } from "./transport";

export type EarnTokenCatalogRequest = {
  readonly network?: Network;
  readonly enter: true;
  readonly yieldTypes?: ReadonlyArray<KnownApiYieldType>;
};

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
    function* (request: EarnTokenCatalogRequest) {
      return yield* legacyApi
        .TokenControllerGetTokens({
          params: {
            enter: request.enter,
            network: request.network,
            yieldTypes: request.yieldTypes,
          },
        })
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
    make: Effect.map(ApiTransportService, ({ resources }) =>
      makeLegacyResourceSource(resources.legacy)
    ),
  }
) {
  static readonly layer = Layer.effect(
    LegacyResourceSource,
    LegacyResourceSource.make
  );
}
