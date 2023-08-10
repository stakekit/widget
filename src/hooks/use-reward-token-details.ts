import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { State } from "../state/stake/types";

export const useRewardTokenDetails = (
  yieldOpportunity: State["selectedStake"]
) => {
  return useMemo(
    () =>
      yieldOpportunity
        .chain((y) =>
          Maybe.fromNullable(y.config.rewardTokens).chain((rt) =>
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
