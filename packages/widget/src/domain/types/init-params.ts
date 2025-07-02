import type { YieldDto } from "@stakekit/api-hooks";
import type { SupportedSKChains } from "./chains";
import type { TokenString } from "./tokens";

export type InitParams = {
  network: SupportedSKChains | null;
  token: TokenString | (string & {}) | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: YieldDto | null;
  accountId: string | null;
  tab: "earn" | "positions" | null;
};
