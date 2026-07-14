import { Data } from "effect";
import type { WalletAddress } from "../../domain/schema/identifiers";
import type { Network } from "../../domain/schema/network-model";
import {
  type ActivityFilter,
  getActivityFilterYieldTypes,
} from "../../pages/details/activity-page/activity-filters";

const ACTIVITY_ACTION_STATUSES = ["SUCCESS", "FAILED"] as const;

export const getActivityActionsRequestParams = ({
  address,
  filter,
  limit,
  network,
  offset,
}: {
  readonly address: string;
  readonly filter: ActivityFilter;
  readonly limit: number;
  readonly network: Network;
  readonly offset: number;
}) => {
  const yieldTypes = getActivityFilterYieldTypes(filter);

  return {
    address,
    limit,
    offset,
    network,
    statuses: ACTIVITY_ACTION_STATUSES,
    ...(yieldTypes?.length ? { yieldTypes } : {}),
  };
};

export class ActivityActionsKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly enabled: boolean;
  readonly filter: ActivityFilter;
  readonly network: Network | null;
}> {}
