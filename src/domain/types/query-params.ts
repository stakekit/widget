import type { YieldDto } from "@stakekit/api-hooks";

export type QueryParams = {
  network: string | null;
  token: string | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: YieldDto | null;
  referralCode: string | null;
  accountId: string | null;
};
