import { useMemo } from "react";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import { getYieldRewardTokens } from "../../domain/types/yields";
import { getRewardTokenSymbols } from "./get-reward-token-symbols";

export const useRewardTokenDetails = (
  yieldOpportunity: EarnYieldWithProvider | null
) => {
  return useMemo(() => {
    const provider = yieldOpportunity?.provider;
    if (!yieldOpportunity || !provider) return null;

    const rewardTokens = getYieldRewardTokens(yieldOpportunity);
    return {
      logoUri: provider.logoURI ?? null,
      rewardTokens,
      symbols: getRewardTokenSymbols(rewardTokens),
      providerName: provider.name ?? null,
    };
  }, [yieldOpportunity]);
};
