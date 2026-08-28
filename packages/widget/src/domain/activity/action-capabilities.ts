import { DateTime, Duration } from "effect";
import type { YieldAction } from "../action/models";
import {
  ActionStatus,
  type ActionStatus as ActionStatusValue,
} from "../action/rules";
import type { EarnYield } from "../earn/models";
import {
  type WalletScopeKey,
  walletScopeOwnerKey,
} from "../wallet/wallet-scope";

export type ActivityActionCapabilities = Readonly<{
  readonly visibleInFeed: boolean;
}>;

export const getActivityActionCapabilities = (
  status: ActionStatusValue
): ActivityActionCapabilities => {
  switch (status) {
    case ActionStatus.SUCCESS:
      return { visibleInFeed: true };
    case ActionStatus.WAITING_FOR_NEXT:
      return { visibleInFeed: true };
    case ActionStatus.FAILED:
      return { visibleInFeed: true };
    case ActionStatus.CANCELED:
    case ActionStatus.CREATED:
    case ActionStatus.PROCESSING:
    case ActionStatus.STALE:
      return { visibleInFeed: false };
  }
};

export const isContinuableYieldAction = (
  action: YieldAction,
  now: DateTime.Utc
): boolean =>
  action.status === ActionStatus.WAITING_FOR_NEXT &&
  Duration.isLessThan(
    DateTime.distance(action.createdAt, now),
    Duration.hours(168)
  );

export const isActivityActionOwnedByScope = ({
  action,
  scope,
  yieldData,
}: {
  readonly action: YieldAction;
  readonly scope: Pick<WalletScopeKey, "address" | "network">;
  readonly yieldData: Pick<EarnYield, "network"> | null;
}): boolean => {
  const actionOwner = walletScopeOwnerKey({
    address: action.address,
    network: scope.network,
  });
  const scopeOwner = walletScopeOwnerKey(scope);

  return (
    actionOwner.address === scopeOwner.address &&
    (yieldData === null || yieldData.network === scopeOwner.network)
  );
};
