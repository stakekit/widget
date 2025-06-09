import type { TokenString } from "@sk-widget/domain/types/tokens";
import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { useCallback } from "react";
import { tokenString } from "../../../../domain";

export const useGetTokenBalancesMap = () =>
  useCallback(
    ({
      defaultTokens,
      tokenBalancesScan,
    }: {
      tokenBalancesScan: TokenBalanceScanResponseDto[];
      defaultTokens: TokenBalanceScanResponseDto[];
    }) =>
      new Map<TokenString, TokenBalanceScanResponseDto>([
        ...(defaultTokens ?? []).map((v) => [tokenString(v.token), v] as const),
        ...(tokenBalancesScan ?? []).map(
          (v) => [tokenString(v.token), v] as const
        ),
      ]),
    []
  );
