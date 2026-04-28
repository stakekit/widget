import {
  type BalanceResponseDto,
  type BalancesRequestDto,
  customFetch,
  type PriceRequestDto,
  type PriceResponseDto,
  type TokenBalanceScanDto,
  type TokenBalanceScanResponseDto,
  type TokenGetTokensParams,
  type TokenWithAvailableYieldsDto,
  type TransactionVerificationMessageDto,
  type TransactionVerificationMessageRequestDto,
  type YieldDto,
  type YieldRewardsSummaryRequestDto,
  type YieldRewardsSummaryResponseDto,
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

export const tokenGetTokens = (
  params?: TokenGetTokensParams,
  signal?: AbortSignal
) =>
  customFetch<TokenWithAvailableYieldsDto[]>({
    url: "/v1/tokens",
    method: "GET",
    params,
    signal,
  });

export const tokenGetTokenPrices = (priceRequestDto: PriceRequestDto) =>
  customFetch<PriceResponseDto>({
    url: "/v1/tokens/prices",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: priceRequestDto,
  });

export const tokenGetTokenBalances = (balancesRequestDto: BalancesRequestDto) =>
  customFetch<BalanceResponseDto[]>({
    url: "/v1/tokens/balances",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: balancesRequestDto,
  });

export const yieldGetSingleYieldRewardsSummary = (
  integrationId: string,
  yieldRewardsSummaryRequestDto: YieldRewardsSummaryRequestDto
) =>
  customFetch<YieldRewardsSummaryResponseDto>({
    url: `/v1/yields/${integrationId}/rewards-summary`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: yieldRewardsSummaryRequestDto,
  });

export const transactionGetTransactionVerificationMessageForNetwork = (
  network: string,
  transactionVerificationMessageRequestDto: TransactionVerificationMessageRequestDto
) =>
  customFetch<TransactionVerificationMessageDto>({
    url: `/v1/transactions/verification/${network}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: transactionVerificationMessageRequestDto,
  });
