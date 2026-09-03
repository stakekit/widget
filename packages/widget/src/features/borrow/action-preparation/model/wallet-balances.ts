import type BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Market } from "../../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../../domain/borrow/catalog/token";
import { decodeTokenId, type TokenId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import { exactZero } from "../../../../domain/finance/exact";
import type { TokenBalance } from "../../../../domain/finance/models";
import { equalTokens } from "../../../../domain/token/token";

type BorrowBalanceToken = Pick<
  BorrowToken,
  "address" | "decimals" | "name" | "symbol"
>;

type BorrowTokenWalletBalance = {
  readonly amount: string;
  readonly amountValue: BigNumber;
  readonly balance: TokenBalance | null;
  readonly network: BorrowNetwork;
  readonly token: BorrowBalanceToken;
};

type BorrowCollateralWalletBalance = BorrowTokenWalletBalance & {
  readonly collateralToken: CollateralToken;
};

export type BorrowMarketWalletBalances = {
  readonly loanToken: BorrowTokenWalletBalance;
  readonly collateralTokens: ReadonlyArray<BorrowCollateralWalletBalance>;
  readonly selectedCollateralToken: BorrowCollateralWalletBalance | null;
};

const isBorrowTokenBalanceMatch = ({
  balance,
  network,
  token,
}: {
  readonly balance: TokenBalance;
  readonly network: BorrowNetwork;
  readonly token: BorrowBalanceToken;
}) => equalTokens({ ...token, network }, balance.token);

export const deriveBorrowTokenWalletBalance = ({
  balances,
  network,
  token,
}: {
  readonly balances: ReadonlyArray<TokenBalance>;
  readonly network: BorrowNetwork;
  readonly token: BorrowBalanceToken;
}): BorrowTokenWalletBalance => {
  const balance =
    balances.find((candidate) =>
      isBorrowTokenBalanceMatch({ balance: candidate, network, token })
    ) ?? null;
  const amountValue = balance?.amount ?? exactZero();

  return {
    amount: amountValue.toFixed(),
    amountValue,
    balance,
    network,
    token,
  };
};

export const deriveBorrowMarketWalletBalances = ({
  balances,
  market,
  selectedCollateralTokenId,
}: {
  readonly balances: ReadonlyArray<TokenBalance>;
  readonly market: Market;
  readonly selectedCollateralTokenId?: TokenId | null;
}): BorrowMarketWalletBalances => {
  const collateralTokens = market.collateralTokens.map((collateralToken) => ({
    ...deriveBorrowTokenWalletBalance({
      balances,
      network: market.network,
      token: collateralToken.token,
    }),
    collateralToken,
  }));
  const selectedCollateralToken =
    (selectedCollateralTokenId
      ? collateralTokens.find(
          (balance) =>
            decodeTokenId(balance.collateralToken.token) ===
            selectedCollateralTokenId
        )
      : collateralTokens[0]) ?? null;

  return {
    loanToken: deriveBorrowTokenWalletBalance({
      balances,
      network: market.network,
      token: market.loanToken,
    }),
    collateralTokens,
    selectedCollateralToken,
  };
};
