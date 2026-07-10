import BigNumber from "bignumber.js";
import type { TokenBalance } from "../../domain/schema/financial-models";
import type {
  BorrowNetwork,
  BorrowToken,
  CollateralToken,
  Market,
  TokenAddress,
} from "../domain";

type BorrowBalanceToken = Pick<
  BorrowToken,
  "address" | "decimals" | "name" | "symbol"
>;

export type BorrowTokenWalletBalance = {
  readonly amount: string;
  readonly amountValue: BigNumber;
  readonly balance: TokenBalance | null;
  readonly network: BorrowNetwork;
  readonly token: BorrowBalanceToken;
};

export type BorrowCollateralWalletBalance = BorrowTokenWalletBalance & {
  readonly collateralToken: CollateralToken;
};

export type BorrowMarketWalletBalances = {
  readonly loanToken: BorrowTokenWalletBalance;
  readonly collateralTokens: ReadonlyArray<BorrowCollateralWalletBalance>;
  readonly selectedCollateralToken: BorrowCollateralWalletBalance | null;
};

const normalizeAddress = (address?: string) => address?.toLowerCase();

const sameAddress = (left?: string, right?: string) => {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);

  return (
    !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight
  );
};

const sameNativeToken = (token: BorrowBalanceToken, balance: TokenBalance) =>
  !token.address &&
  !balance.token.address &&
  token.symbol.toLowerCase() === balance.token.symbol.toLowerCase();

export const isBorrowTokenBalanceMatch = ({
  balance,
  network,
  token,
}: {
  readonly balance: TokenBalance;
  readonly network: BorrowNetwork;
  readonly token: BorrowBalanceToken;
}) =>
  balance.token.network === network &&
  (sameAddress(token.address, balance.token.address) ||
    sameNativeToken(token, balance));

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
  const amountValue = balance?.amount ?? new BigNumber(0);

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
  selectedCollateralTokenAddress,
}: {
  readonly balances: ReadonlyArray<TokenBalance>;
  readonly market: Market;
  readonly selectedCollateralTokenAddress?: TokenAddress | string | null;
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
    (selectedCollateralTokenAddress
      ? collateralTokens.find((balance) =>
          sameAddress(
            balance.collateralToken.token.address,
            selectedCollateralTokenAddress
          )
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
