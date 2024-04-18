import { useMemo } from "react";
import { config } from "../../config";
import { usePrices } from "./use-prices";
import type { PriceRequestDto } from "@stakekit/api-hooks";
import { getBaseToken } from "../../domain";
import { tokenToTokenDto } from "../../utils/mappers";
import type { State } from "../../state/stake/types";

export const useSelectedStakePrice = ({
  selectedTokenBalance,
}: {
  selectedTokenBalance: State["selectedTokenBalance"];
}) => {
  const priceRequestDto = useMemo((): PriceRequestDto | null => {
    return selectedTokenBalance
      .map((stb) => {
        return {
          currency: config.currency,
          tokenList: [stb.token, tokenToTokenDto(getBaseToken(stb.token))],
        };
      })
      .extractNullable();
  }, [selectedTokenBalance]);

  return usePrices(priceRequestDto);
};
