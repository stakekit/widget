import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  RewardsAddresses,
  type RewardsSummary,
} from "../domain/schema/dashboard-models";
import { YieldId } from "../domain/schema/identifiers";
import { isValidYieldIdForRewardsSummary } from "../domain/types/rewards";
import type { Yield } from "../domain/types/yields";
import { useSKWallet } from "../providers/sk-wallet";
import { RewardsSummaryKey, rewardsSummaryAtom } from "./api/dashboard-atoms";

export type RewardsSummaryResult = Record<string, RewardsSummary>;

const useRewardsSummaryResource = (
  yieldIds: ReadonlyArray<string>,
  enabled: boolean
) => {
  const { address, additionalAddresses } = useSKWallet();
  const filteredIds = yieldIds.filter(isValidYieldIdForRewardsSummary);
  const decodedIds = Schema.decodeUnknownSync(Schema.Array(YieldId))(
    filteredIds
  );
  const addresses = address
    ? Schema.decodeUnknownSync(RewardsAddresses)({
        address,
        ...(additionalAddresses ? { additionalAddresses } : {}),
      })
    : null;
  const resource = rewardsSummaryAtom(
    new RewardsSummaryKey({
      addresses,
      enabled: enabled && !!addresses && decodedIds.length > 0,
      yieldIds: decodedIds,
    })
  );
  const result = useAtomValue(resource);

  return {
    refresh: useAtomRefresh(resource),
    result,
    value: result.pipe(AsyncResult.value, Option.getOrUndefined),
  };
};

export const useMultiRewardsSummary = <T = RewardsSummaryResult>(
  yieldIds: Yield["id"][],
  opts?: { select?: (val: RewardsSummaryResult) => T }
) => {
  const { refresh, result, value } = useRewardsSummaryResource(yieldIds, true);

  return {
    data:
      value === undefined || value === null
        ? undefined
        : opts?.select
          ? opts.select(value)
          : (value as T),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};

export const useRewardsSummary = (yieldId: Yield["id"]) => {
  const enabled = isValidYieldIdForRewardsSummary(yieldId);
  const { refresh, result, value } = useRewardsSummaryResource(
    enabled ? [yieldId] : [],
    enabled
  );
  const decodedYieldId = Schema.decodeUnknownSync(YieldId)(yieldId);
  const data = value?.[decodedYieldId];

  return {
    data: data ? { yieldId, data } : undefined,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
