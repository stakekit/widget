import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import type { ExtraData } from "@sk-widget/pages/details/earn-page/state/types";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useRewardTokenDetails = (
  yieldOpportunity: ExtraData["selectedStake"]
) => {
  return useMemo(
    () =>
      yieldOpportunity
        .chain((y) =>
          Maybe.fromNullable(y.metadata.rewardTokens).chain((rt) =>
            Maybe.fromNullable(y.metadata.provider).map((p) => ({ rt, p }))
          )
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
