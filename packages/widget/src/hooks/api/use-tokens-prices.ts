import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { config } from "../../config";
import type { TokenDto, YieldTokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";
import { usePrices } from "./use-prices";

/**
 * Requested Token + Yield base token + Yield gas fee token prices
 */
export const useTokensPrices = ({
  token,
  yieldDto,
}: {
  token: Maybe<TokenDto | YieldTokenDto>;
  yieldDto: Maybe<Yield>;
}) => {
  const priceRequestDto = useMemo(
    () =>
      Maybe.fromRecord({ yieldDto, token })
        .map((val) => ({
          currency: config.currency,
          tokenList: [val.token, val.token, val.yieldDto.mechanics.gasFeeToken],
        }))
        .extractNullable(),
    [yieldDto, token]
  );

  return usePrices(priceRequestDto);
};
