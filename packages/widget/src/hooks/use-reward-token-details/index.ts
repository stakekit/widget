import { Maybe } from "purify-ts";
import { useMemo } from "react";
import {
  getYieldProviderDetails,
  getYieldRewardTokens,
  type Yield,
} from "../../domain/types/yields";
import { getRewardTokenSymbols } from "./get-reward-token-symbols";

export const useRewardTokenDetails = (yieldOpportunity: Maybe<Yield>) => {
  return useMemo(
    () =>
      yieldOpportunity
        .chain((y) =>
          Maybe.fromNullable(getYieldProviderDetails(y)).map((p) => ({
            p,
            rt: getYieldRewardTokens(y),
          }))
        )
        .map(({ p, rt }) => ({
          logoUri: p.logoURI ?? null,
          rewardTokens: rt,
          symbols: getRewardTokenSymbols(rt),
          providerName: p.name ?? null,
        })),
    [yieldOpportunity]
  );
};
