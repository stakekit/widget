import { useMemo } from "react";
import { config } from "../../config";
import { usePrices } from "./use-prices";
import { PriceRequestDto } from "@stakekit/api-hooks";
import { getBaseToken } from "../../domain";
import { Token } from "@stakekit/common";
import { tokenToTokenDto } from "../../utils/mappers";
import { State } from "../../state/stake/types";

export const useSelectedStakePrice = ({
  selectedStake,
}: {
  selectedStake: State["selectedStake"];
}) => {
  const priceRequestDto = useMemo((): PriceRequestDto | null => {
    return selectedStake
      .map((y) => {
        return {
          currency: config.currency,
          tokenList: [y.token, tokenToTokenDto(getBaseToken(y.token as Token))],
        };
      })
      .extractNullable();
  }, [selectedStake]);

  return usePrices(priceRequestDto);
};
