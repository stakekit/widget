import { priceResponseDtoToPrices } from "../../utils/mappers";
import type { PriceRequestDto, PriceResponseDto } from "@stakekit/api-hooks";
import { useTokenGetTokenPrices } from "@stakekit/api-hooks";
import { createSelector } from "reselect";

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

export const usePrices = (
  priceRequestDto: PriceRequestDto | null | undefined
) => {
  return useTokenGetTokenPrices(priceRequestDto ?? defaultParam, {
    query: { enabled: !!priceRequestDto, select: pricesSelector },
  });
};
