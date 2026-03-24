import { Maybe } from "purify-ts";
import { useMemo } from "react";
import {
  getYieldProviderDetails,
  getYieldRewardTokens,
} from "../../domain/types/yields";
import type { ExtraData } from "../../pages/details/earn-page/state/types";
import { getRewardTokenSymbols } from "./get-reward-token-symbols";

export const useRewardTokenDetails = (
  yieldOpportunity: ExtraData["selectedStake"],
) => {
  return useMemo(
    () =>
      yieldOpportunity
        .chain((y) =>
          Maybe.fromNullable(getYieldProviderDetails(y)).map((p) => ({
            p,
            rt: getYieldRewardTokens(y),
          })),
        )
        .map(({ p, rt }) => ({
          logoUri: p.logoURI ?? null,
          rewardTokens: rt,
          symbols: getRewardTokenSymbols(rt),
          providerName: p.name ?? null,
        })),
    [yieldOpportunity],
  );
};
