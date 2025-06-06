import type { Price } from "@sk-widget/domain/types/price";
import { Prices } from "@sk-widget/domain/types/price";
import type { TokenString } from "@sk-widget/domain/types/tokens";
import type { PriceResponseDto } from "@stakekit/api-hooks";

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
