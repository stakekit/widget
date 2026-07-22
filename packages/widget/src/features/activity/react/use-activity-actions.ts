import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { walletScopeAtom } from "../../wallet/public-state";
import type { ActivityFilter } from "../model/filters";
import {
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterOptionsAtom,
} from "../resources/activity-actions";
import { ActivityActionsKey } from "../resources/activity-requests";

export const useActivityFilterOptions = () => {
  const scope = useAtomValue(walletScopeAtom);

  return useAtomValue(
    activityFilterOptionsAtom(new ActivityFilterOptionsKey({ scope }))
  );
};

export const useActivityActions = (filter: ActivityFilter = "all") => {
  const scope = useAtomValue(walletScopeAtom);
  const resource = activityActionsPullAtom(
    new ActivityActionsKey({ filter, scope })
  );
  const [result, pull] = useAtom(resource);
  const refresh = useAtomRefresh(resource);

  return { pull, refresh, result } as const;
};
