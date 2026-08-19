import { Data } from "effect";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import { ActivityHistoryKey } from "../../../../resources/activity-history/index";
import {
  type ActivityFilter,
  getActivityFilterYieldTypes,
} from "../../model/filters";

const ACTIVITY_ACTION_STATUSES = ["SUCCESS", "FAILED"] as const;

export class ActivityActionsKey extends Data.Class<{
  readonly filter: ActivityFilter;
  readonly scope: WalletScopeKey | null;
}> {}

export const getActivityHistoryKey = (
  key: ActivityActionsKey
): ActivityHistoryKey | null => {
  if (!key.scope) return null;

  return new ActivityHistoryKey({
    scope: key.scope,
    statuses: ACTIVITY_ACTION_STATUSES,
    yieldTypes: getActivityFilterYieldTypes(key.filter),
  });
};
