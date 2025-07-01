import type { PriceRequestDto, PriceResponseDto } from "@stakekit/api-hooks";
import { useTokenGetTokenPrices } from "@stakekit/api-hooks";
import { useCallback } from "react";
import { createSelector } from "reselect";
import type { Prices } from "../../domain/types/price";
import { priceResponseDtoToPrices } from "../../utils/mappers";

const defaultParam: PriceRequestDto = {
  currency: "USD",
  tokenList: [
    { network: "ethereum", name: "Ethereum", symbol: "ETH", decimals: 18 },
  ],
};

const pricesSelector = createSelector(
  (val: PriceResponseDto) => val,
  (val) => priceResponseDtoToPrices(val)
);

export const usePrices = <T = Prices>(
  priceRequestDto: PriceRequestDto | null | undefined,
  opts?: {
    enabled?: boolean;
    select?: (val: Prices) => T;
  }
) => {
  return useTokenGetTokenPrices(priceRequestDto ?? defaultParam, {
    query: {
      enabled: !!priceRequestDto && opts?.enabled,
      select: useCallback(
        (res: PriceResponseDto): T => {
          const mapped = pricesSelector(res);

          if (opts?.select) {
            return opts.select(mapped);
          }

          return mapped as T;
        },
        [opts?.select]
      ),
    },
  });
};
