import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";

export type ActivityPageContextType = {
  defaultTokens: Maybe<TokenBalanceScanResponseDto[]>;
  tokenSearch: string;
  onTokenSearch: (val: string) => void;
  onTokenSelect: (val: TokenBalanceScanResponseDto) => void;
  selectedToken: TokenBalanceScanResponseDto | undefined;
};
