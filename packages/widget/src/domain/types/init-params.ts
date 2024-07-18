import type { TokenString } from "@sk-widget/domain/types";
import type { SupportedSKChains } from "@sk-widget/domain/types/chains";
import type { YieldDto } from "@stakekit/api-hooks";

export type InitParams = {
  network: SupportedSKChains | null;
  token: TokenString | (string & {}) | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: YieldDto | null;
  referralCode: string | null;
  accountId: string | null;
  tab: "earn" | "positions" | null;
};
