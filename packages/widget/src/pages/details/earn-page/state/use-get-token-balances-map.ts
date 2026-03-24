import { useCallback } from "react";
import { tokenString } from "../../../../domain";
import type { TokenBalanceScanResponseDto } from "../../../../domain/types/token-balance";
import type { TokenString } from "../../../../domain/types/tokens";

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
