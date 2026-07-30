import type { BorrowToken } from "../../domain/borrow/catalog/token";
import type { BorrowNetwork } from "../../domain/borrow/network";
import type { AppToken } from "../../domain/schema/legacy-models";

export const borrowTokenToAppToken = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): AppToken => ({
  address: token.address,
  decimals: token.decimals,
  name: token.name,
  network: network as AppToken["network"],
  symbol: token.symbol,
});
