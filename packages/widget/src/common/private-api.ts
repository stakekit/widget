import {
  customFetch,
  type TokenBalanceScanDto,
  type TokenBalanceScanResponseDto,
  type ValidatorSearchResultDto,
  type YieldDto,
} from "@stakekit/api-hooks";

/**
 * Scans for tokens with balance with available yields
 * @summary Scan for token balances
 */
export const tokenTokenBalancesScan = (
  tokenBalanceScanDto: TokenBalanceScanDto,
  signal?: AbortSignal
) => {
  return customFetch<TokenBalanceScanResponseDto[]>({
    url: "/v1/tokens/balances/scan",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: tokenBalanceScanDto,
    signal,
  });
};

/**
 * Returns a yield that is associated with given integration ID
 * @summary Get a yield given an integration ID
 */
export const yieldYieldOpportunity = (
  integrationId: string,
  params?: { ledgerWalletAPICompatible?: boolean },
  signal?: AbortSignal
) => {
  return customFetch<YieldDto>({
    url: `/v1/yields/${integrationId}`,
    method: "GET",
    headers: { "Content-Type": "application/json" },
    params,
    signal,
  });
};

export type YieldFindValidatorsParams = {
  ledgerWalletAPICompatible?: boolean;
  network?: string;
  query?: string;
};

/**
 * Returns a list of available validators to specify when providing a `validatorAddress` property.
 * @summary Get validators
 */
export const yieldFindValidators = (
  params?: YieldFindValidatorsParams,
  signal?: AbortSignal
) => {
  return customFetch<ValidatorSearchResultDto[]>({
    url: "/v1/yields/validators",
    method: "GET",
    params,
    signal,
  });
};
