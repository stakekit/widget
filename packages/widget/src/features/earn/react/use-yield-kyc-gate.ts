import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import {
  isKycGateBlocking,
  mapKycStatusToGate,
} from "../../../domain/types/kyc";

import {
  CurrentYieldKycKey,
  currentYieldKycQueryEnabledAtom,
  currentYieldKycRefreshAtom,
  currentYieldKycStatusAtom,
} from "../resources/yield-insights";

export const useYieldKycGate = ({
  enabled = true,
  yieldDto,
}: {
  readonly enabled?: boolean;
  readonly yieldDto: EarnYieldWithProvider | null;
}) => {
  const selectedYield = yieldDto;
  const yieldId = selectedYield?.id ?? null;
  const key = new CurrentYieldKycKey({
    enabled,
    kycRequired: selectedYield?.mechanics.requirements?.kycRequired === true,
    yieldId,
  });
  const queryEnabled = useAtomValue(currentYieldKycQueryEnabledAtom(key));
  const resource = currentYieldKycStatusAtom(key);
  const result = useAtomValue(resource);
  const refresh = useAtomValue(currentYieldKycRefreshAtom(key));
  const status = result.pipe(AsyncResult.value, Option.getOrUndefined);
  const isFetching = queryEnabled && result.waiting;
  const gate = !queryEnabled
    ? ({ state: "pass" } as const)
    : AsyncResult.isFailure(result)
      ? mapKycStatusToGate({ status: null, yieldDto: selectedYield })
      : mapKycStatusToGate({ status, yieldDto: selectedYield });

  return {
    data: status === null ? undefined : status,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    gate,
    isError: AsyncResult.isFailure(result),
    isFetching,
    isGateBlocking:
      queryEnabled &&
      (AsyncResult.isInitial(result) || isKycGateBlocking(gate)),
    isKycEnabled: queryEnabled,
    isLoading: queryEnabled && AsyncResult.isInitial(result),
    isRefetching: isFetching && status !== undefined,
    refetch: refresh,
  } as const;
};
