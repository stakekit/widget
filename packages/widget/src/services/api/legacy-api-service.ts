import { Context, Effect, Layer, Schema } from "effect";
import {
  type RewardsAddresses,
  RewardsSummaryRecord,
} from "../../domain/schema/dashboard-models";
import {
  EarnLegacyTokenOptionsResponse,
  EarnTokenBalancesResponse,
} from "../../domain/schema/earn-models";
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

export const makeLegacyApiService = (legacy: LegacyApi.LegacyApi) => {
  const scanTokenBalances = Effect.fn("LegacyApiService.scanTokenBalances")(
    function* (command: TokenBalanceScanCommand) {
      return yield* legacy
        .TokenControllerTokenBalancesScan({ payload: command })
        .pipe(decodeApiResponse("token-balances-scan", TokenBalancesResponse));
    }
  );

  const getGasTokenBalances = Effect.fn("LegacyApiService.getGasTokenBalances")(
    function* (command: GasBalancesCommand) {
      return yield* legacy
        .TokenControllerGetTokenBalances({ payload: command })
        .pipe(decodeApiResponse("gas-balance-check", GasTokenBalancesResponse));
    }
  );

  const getPrices = Effect.fn("LegacyApiService.getPrices")(function* (
    request: PriceRequest
  ) {
    const payload = yield* encodeApiRequest(
      "token-prices-request",
      PriceRequest
    )(request);

    return yield* legacy
      .TokenControllerGetTokenPrices({ payload })
      .pipe(decodeApiResponse("token-prices", PriceResponse));
  });

  const getEnabledNetworks = Effect.fn("LegacyApiService.getEnabledNetworks")(
    function* () {
      return yield* legacy
        .YieldControllerGetMyNetworks(undefined)
        .pipe(decodeApiResponse("enabled-networks", EnabledNetworksResponse));
    }
  );

  const getLegacyTokenOptions = Effect.fn(
    "LegacyApiService.getLegacyTokenOptions"
  )(function* (network?: Network) {
    return yield* legacy
      .TokenControllerGetTokens({ params: { network } })
      .pipe(
        decodeApiResponse(
          "legacy-token-options",
          EarnLegacyTokenOptionsResponse
        )
      );
  });

  const scanEarnTokenBalances = Effect.fn(
    "LegacyApiService.scanEarnTokenBalances"
  )(function* (request: {
    readonly additionalAddresses?: TokenBalanceScanCommand["addresses"]["additionalAddresses"];
    readonly address: string;
    readonly network: Network;
  }) {
    return yield* legacy
      .TokenControllerTokenBalancesScan({
        payload: {
          addresses: {
            address: request.address,
            additionalAddresses: request.additionalAddresses,
          },
          network: request.network,
        },
      })
      .pipe(
        decodeApiResponse("earn-token-balances-scan", EarnTokenBalancesResponse)
      );
  });

  const getRewardsSummaries = Effect.fn("LegacyApiService.getRewardsSummaries")(
    function* (request: {
      readonly addresses: RewardsAddresses;
      readonly yieldIds: ReadonlyArray<YieldId>;
    }) {
      const responses = yield* Effect.forEach(
        request.yieldIds,
        (yieldId) =>
          legacy
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
    }
  );

  return {
    getEnabledNetworks,
    getGasTokenBalances,
    getLegacyTokenOptions,
    getPrices,
    getRewardsSummaries,
    scanEarnTokenBalances,
    scanTokenBalances,
  } as const;
};

export class LegacyApiService extends Context.Service<LegacyApiService>()(
  "stakekit/widget/services/api/LegacyApiService",
  {
    make: Effect.map(ApiTransportService, ({ legacy }) =>
      makeLegacyApiService(legacy)
    ),
  }
) {
  static readonly layer = Layer.effect(LegacyApiService, LegacyApiService.make);
}
