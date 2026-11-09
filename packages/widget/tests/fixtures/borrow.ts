import { Schema } from "effect";

import {
  BorrowAccountSnapshot,
  type DebtBalance,
  type SupplyBalance,
} from "../../src/domain/borrow/borrow-account-snapshot";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";

/**
 * Borrow API payloads in their encoded shape, defaulting to one Aave V3
 * Ethereum USDC pool backed by WETH collateral. Pass overrides for the values a
 * scenario depends on.
 */
export type BorrowIntegrationDto = typeof Integration.Encoded;
export type BorrowMarketDto = typeof Market.Encoded;
export type BorrowCollateralTokenDto =
  BorrowMarketDto["collateralTokens"][number];
export type BorrowAccountSnapshotDto = typeof BorrowAccountSnapshot.Encoded;
export type BorrowDebtBalanceDto = typeof DebtBalance.Encoded;
export type BorrowSupplyBalanceDto = typeof SupplyBalance.Encoded;

export const borrowWalletAddress = "0x0000000000000000000000000000000000000001";
export const usdcTokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const aaveIntegrationId = "aave-borrow";
const usdcMarketId = "aave-v3-ethereum-usdc";

export const makeBorrowIntegrationDto = (
  overrides: Partial<BorrowIntegrationDto> = {}
): BorrowIntegrationDto => ({
  id: aaveIntegrationId,
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
  ...overrides,
});

export const makeBorrowCollateralTokenDto = (
  overrides: Partial<BorrowCollateralTokenDto> = {}
): BorrowCollateralTokenDto => ({
  liquidationPenalty: "0.05",
  liquidationThreshold: "0.85",
  maxLtv: "0.8",
  priceUsd: "2000",
  supplyRate: "0.02",
  token: {
    address: wethTokenAddress,
    decimals: 18,
    name: "Wrapped Ether",
    symbol: "WETH",
  },
  ...overrides,
});

export const makeBorrowMarketDto = (
  overrides: Partial<BorrowMarketDto> = {}
): BorrowMarketDto => ({
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  blueBundleOriginationFeeBps: null,
  borrowRate: "0.06",
  collateralTokens: [makeBorrowCollateralTokenDto()],
  id: usdcMarketId,
  integrationId: aaveIntegrationId,
  isBorrowEnabled: true,
  loanToken: {
    address: usdcTokenAddress,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  loanTokenPriceUsd: "1",
  minLoan: null,
  network: "ethereum",
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  poolAddress: "0x0000000000000000000000000000000000000001",
  supplyCollateralFeeBps: "0",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  type: "pool",
  utilizationRate: "0.5",
  ...overrides,
});

/** 400 USDC of debt in the default market, without pending actions. */
export const makeBorrowDebtBalanceDto = (
  overrides: Partial<BorrowDebtBalanceDto> = {}
): BorrowDebtBalanceDto => ({
  apy: "0.06",
  balance: "400",
  balanceRaw: "400000000",
  balanceUsd: "400",
  marketId: usdcMarketId,
  pendingActions: [],
  tokenAddress: usdcTokenAddress,
  tokenSymbol: "USDC",
  ...overrides,
});

/** 0.5 WETH ($1000) supplied as collateral in the default market. */
export const makeBorrowSupplyBalanceDto = (
  overrides: Partial<BorrowSupplyBalanceDto> = {}
): BorrowSupplyBalanceDto => ({
  apy: "0.02",
  balance: "0.5",
  balanceRaw: "500000000000000000",
  balanceUsd: "1000",
  isCollateral: true,
  marketId: usdcMarketId,
  pendingActions: [],
  tokenAddress: wethTokenAddress,
  tokenSymbol: "WETH",
  ...overrides,
});

/** An Aave account holding the default debt balance and no supply. */
export const makeBorrowAccountSnapshotDto = (
  overrides: Partial<BorrowAccountSnapshotDto> = {}
): BorrowAccountSnapshotDto => ({
  address: borrowWalletAddress,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [makeBorrowDebtBalanceDto()],
  healthFactor: "2.125",
  integrationId: aaveIntegrationId,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
  ...overrides,
});

export const makeBorrowIntegration = (
  overrides: Partial<BorrowIntegrationDto> = {}
): Integration =>
  Schema.decodeSync(Integration)(makeBorrowIntegrationDto(overrides));

export const makeBorrowMarket = (
  overrides: Partial<BorrowMarketDto> = {}
): Market => Schema.decodeSync(Market)(makeBorrowMarketDto(overrides));

export const makeBorrowAccountSnapshot = (
  overrides: Partial<BorrowAccountSnapshotDto> = {}
): BorrowAccountSnapshot =>
  Schema.decodeSync(BorrowAccountSnapshot)(
    makeBorrowAccountSnapshotDto(overrides)
  );
