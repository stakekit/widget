import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { config } from "../../config";
import type { YieldTokenDto } from "../../providers/yield-api-client-provider/types";
import { useBaseToken } from "../use-base-token";
import { useGasFeeToken } from "../use-gas-fee-token";
import { usePrices } from "./use-prices";

/**
 * Requested Token + Yield base token + Yield gas fee token prices
 */
export const useTokensPrices = ({
  token,
  yieldDto,
}: {
  token: Maybe<TokenDto | YieldTokenDto>;
  yieldDto: Maybe<YieldDto>;
}) => {
  const baseToken = useBaseToken(yieldDto);
  const gasFeeToken = useGasFeeToken(yieldDto);

  const priceRequestDto = useMemo(
    () =>
      Maybe.fromRecord({ baseToken, gasFeeToken, token })
        .map((val) => ({
          currency: config.currency,
          tokenList: [val.token, val.baseToken, val.gasFeeToken],
        }))
        .extractNullable(),
    [baseToken, gasFeeToken, token]
  );

  return usePrices(priceRequestDto);
};
