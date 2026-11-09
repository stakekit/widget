import type { BorrowEntryFlowDetails } from "../../src/features/borrow-transaction-flow/model/session";
import {
  makeBorrowCollateralTokenDto,
  makeBorrowMarket,
} from "../fixtures/borrow";

export const borrowEntryFlowMarket = makeBorrowMarket({
  collateralTokens: [
    makeBorrowCollateralTokenDto({
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
    }),
  ],
  id: "morpho-blue-borrow-base-cbbtc-usdc-86",
  integrationId: "morpho-blue",
  loanToken: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  network: "base",
  poolAddress: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  type: "isolated",
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
