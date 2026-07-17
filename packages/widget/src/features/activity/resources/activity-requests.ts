import { Data } from "effect";
import type { Network } from "../../../domain/schema/network-model";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import {
  type ActivityFilter,
  getActivityFilterYieldTypes,
} from "../model/filters";

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
  readonly filter: ActivityFilter;
  readonly scope: WalletScopeKey | null;
}> {}
