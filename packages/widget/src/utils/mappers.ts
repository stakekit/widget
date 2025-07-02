import type { PriceResponseDto } from "@stakekit/api-hooks";
import type { Price, TokenString } from "../domain/types";
import { Prices } from "../domain/types";

const priceDtoToPrice = (priceDto: PriceResponseDto[string]): Price => ({
  price: priceDto.price,
  price24H: priceDto.price_24_h,
});

export const priceResponseDtoToPrices = (
  priceResponseDto: PriceResponseDto
): Prices =>
  new Prices(
    Object.keys(priceResponseDto).reduce<Prices["value"]>((acc, key) => {
      acc.set(key as TokenString, priceDtoToPrice(priceResponseDto[key]));

      return acc;
    }, new Map())
  );
