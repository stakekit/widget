import { YieldBalanceDto } from "@stakekit/api-hooks";
import { List } from "purify-ts";

export const checkHasPendingClaimRewards = (balances: YieldBalanceDto[]) =>
  List.find((b) => b.type === "rewards", balances)
    .chain((b) =>
      List.find((a) => a.type === "CLAIM_REWARDS", b.pendingActions)
    )
    .isJust();
