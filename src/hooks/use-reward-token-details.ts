import { useMemo } from "react";
import { Maybe } from "purify-ts";
import type { ExtraData } from "@sk-widget/pages/details/earn-page/state/types";

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
          symbol: rt.map((t) => t.symbol).join(", ") ?? null,
          providerName: p.name ?? null,
        })),
    [yieldOpportunity]
  );
};
