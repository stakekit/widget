import type { Market } from "../domain";

export const getBorrowNetworkLogo = (network: Market["network"]) =>
  `https://assets.stakek.it/networks/${network}.svg`;

export const getMarketTokenPairLabel = (market: Market) => {
  const collateralToken = market.collateralTokens[0];

  if (!collateralToken) {
    return market.loanToken.symbol;
  }

  return `${collateralToken.token.symbol}/${market.loanToken.symbol}`;
};
