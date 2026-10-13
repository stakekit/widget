import { Schema } from "effect";
import { Market } from "../../src/domain/borrow/catalog/market";
import type { BorrowEntryFlowDetails } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";

export const borrowEntryFlowMarket = Schema.decodeSync(Market)({
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  blueBundleOriginationFeeBps: null,
  borrowRate: "0.06",
  collateralTokens: [
    {
      liquidationPenalty: "0.05",
      liquidationThreshold: "0.86",
      maxLtv: "0.77",
      priceUsd: "60000",
      supplyRate: "0",
      token: {
        address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        decimals: 8,
        name: "Coinbase Wrapped BTC",
        symbol: "cbBTC",
      },
    },
  ],
  feeWrapperAddress: null,
  id: "morpho-blue-borrow-base-cbbtc-usdc-86",
  integrationId: "morpho-blue",
  isBorrowEnabled: true,
  loanToken: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  loanTokenPriceUsd: "1",
  minLoan: null,
  network: "base",
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  poolAddress: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  supplyCollateralFeeBps: "0",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  type: "isolated",
  utilizationRate: "0.5",
});

export const borrowEntryFlowDetails: BorrowEntryFlowDetails = {
  collateralToken: borrowEntryFlowMarket.collateralTokens[0] ?? null,
  integration: null,
  market: borrowEntryFlowMarket,
};

/** A Borrow Entry flow entry with captured details, for flow fixtures. */
export const borrowEntryFlowEntry = {
  _tag: "BorrowEntry",
  details: borrowEntryFlowDetails,
} as const;

/**
 * A memory-history entry carrying navigation state. Memory history
 * JSON-serializes seeded entries for a dev warning, and Borrow Flow Sessions
 * hold bigints, so the state is attached as a non-enumerable property.
 */
export const withUnserializedState = <Entry extends object>(
  entry: Entry,
  state: unknown
): Entry =>
  Object.defineProperty(entry, "state", { enumerable: false, value: state });
