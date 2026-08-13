import type { BorrowToken } from "../../domain/borrow/catalog/token";
import type { BorrowNetwork } from "../../domain/borrow/network";
import type { Token } from "../../domain/token/token";

export const borrowTokenToAppToken = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): Token => ({
  address: token.address,
  decimals: token.decimals,
  name: token.name,
  network: network as Token["network"],
  symbol: token.symbol,
});
