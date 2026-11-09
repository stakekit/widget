import { Effect } from "effect";

import { EarnLegacyTokenOptionsResponse } from "../../../domain/earn/responses";
import {
  type GasBalancesCommand,
  GasTokenBalancesResponse,
  type TokenBalanceScanCommand,
  TokenBalancesResponse,
} from "../../../domain/finance/models";
import { PriceRequest, PriceResponse } from "../../../domain/finance/prices";
import type * as LegacyApi from "../../../generated/api/legacy";
import type { EarnTokenCatalogRequest } from "../resource-sources";
import { decodeApiResponse, encodeApiRequest } from "./api-operation";

export const makeLegacyResourceSource = (legacyApi: LegacyApi.LegacyApi) => {
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
        .TokenControllerGetTokens({ params: request })
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
        .NetworkAddressesTokenV2ControllerGetTokenBalances(
          command.network,
          command.address,
          {}
        )
        .pipe(decodeApiResponse("token-balances-scan", TokenBalancesResponse));
    }
  );

  return {
    getGasTokenBalances,
    getPrices,
    getTokenOptions,
    scanTokenBalances,
  } as const;
};
