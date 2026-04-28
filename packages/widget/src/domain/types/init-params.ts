import type { SupportedSKChains } from "./chains";
import type { TokenString } from "./tokens";
import type { Yield } from "./yields";

export type InitParams = {
  network: SupportedSKChains | null;
  token: TokenString | (string & {}) | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: Yield | null;
  accountId: string | null;
  tab: "earn" | "positions" | null;
};
