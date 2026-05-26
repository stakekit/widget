import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { createSelector } from "reselect";
import type { StakeKitErrorDto } from "../../domain/types/errors";
import type {
  PriceRequestDto,
  PriceResponseDto,
  Prices,
} from "../../domain/types/price";
import type { YieldTokenDto } from "../../domain/types/tokens";
import { useApiClient } from "../../providers/api/api-client-provider";
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

const getTokenGetTokenPricesQueryKey = (priceRequestDto: PriceRequestDto) =>
  ["/v1/tokens/prices", priceRequestDto] as const;

export const usePrices = <T = Prices>(
  priceRequestDto: PriceRequestInput | null | undefined,
  opts?: {
    enabled?: boolean;
    select?: (val: Prices) => T;
  }
) => {
  const apiClient = useApiClient();
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

  return useQuery<PriceResponseDto, StakeKitErrorDto, T>({
    queryKey: getTokenGetTokenPricesQueryKey(requestDto),
    queryFn: () =>
      apiClient.legacy.TokenControllerGetTokenPrices({ payload: requestDto }),
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
  });
};
