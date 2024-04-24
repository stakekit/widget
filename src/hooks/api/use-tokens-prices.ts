import { useMemo } from "react";
import { config } from "../../config";
import { usePrices } from "./use-prices";
import type { PriceRequestDto, TokenDto, YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useBaseToken } from "../use-base-token";
import { useGasFeeToken } from "../use-gas-fee-token";

/**
 * Requested Token + Yield base token + Yield gas fee token prices
 */
export const useTokensPrices = ({
  token,
  yieldDto,
}: {
  token: Maybe<TokenDto>;
  yieldDto: Maybe<YieldDto>;
}) => {
  const baseToken = useBaseToken(yieldDto);
  const gasFeeToken = useGasFeeToken(yieldDto);

  const priceRequestDto = useMemo(
    () =>
      Maybe.fromRecord({ baseToken, gasFeeToken, token })
        .map<PriceRequestDto>((val) => ({
          currency: config.currency,
          tokenList: [val.token, val.baseToken, val.gasFeeToken],
        }))
        .extractNullable(),
    [baseToken, gasFeeToken, token]
  );

  return usePrices(priceRequestDto);
};
