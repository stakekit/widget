import type { EarnYieldWithProvider } from "../schema/earn-models";
import type { SupportedSKChains } from "./chains";
import type { TokenString } from "./tokens";

export type InitParams = {
  network: SupportedSKChains | null;
  token: TokenString | (string & {}) | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: EarnYieldWithProvider | null;
  accountId: string | null;
  tab: "earn" | "positions" | null;
};
