import type { PriceRequestDto, PriceResponseDto } from "@stakekit/api-hooks";
import { useTokenGetTokenPrices } from "@stakekit/api-hooks";
import { useCallback } from "react";
import { createSelector } from "reselect";
import type { Prices } from "../../domain/types/price";
import type { YieldTokenDto } from "../../providers/yield-api-client-provider/types";
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

type PriceRequestInput = Omit<PriceRequestDto, "tokenList"> & {
  tokenList: (PriceRequestDto["tokenList"][number] | YieldTokenDto)[];
};

export const usePrices = <T = Prices>(
  priceRequestDto: PriceRequestInput | null | undefined,
  opts?: {
    enabled?: boolean;
    select?: (val: Prices) => T;
  }
) => {
  const requestDto = priceRequestDto
    ? ({
        ...priceRequestDto,
        tokenList: priceRequestDto.tokenList.map((token) => ({
          ...token,
          network:
            token.network as PriceRequestDto["tokenList"][number]["network"],
        })),
      } satisfies PriceRequestDto)
    : defaultParam;

  return useTokenGetTokenPrices(requestDto, {
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
