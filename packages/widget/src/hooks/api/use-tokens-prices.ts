import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { config } from "../../config";
import type { TokenDto, YieldTokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";
import { useBaseToken } from "../use-base-token";
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
  const baseToken = useBaseToken(yieldDto);

  const priceRequestDto = useMemo(
    () =>
      Maybe.fromRecord({ baseToken, yieldDto, token })
        .map((val) => ({
          currency: config.currency,
          tokenList: [
            val.token,
            val.baseToken,
            val.yieldDto.mechanics.gasFeeToken,
          ],
        }))
        .extractNullable(),
    [baseToken, yieldDto, token]
  );

  return usePrices(priceRequestDto);
};
