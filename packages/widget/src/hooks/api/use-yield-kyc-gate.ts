import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import { isKycGateBlocking, mapKycStatusToGate } from "../../domain/types/kyc";

import { useSKWallet } from "../../providers/wallet/react/use-wallet";
import { YieldKycKey, yieldKycStatusAtom } from "./dashboard-atoms";

export const useYieldKycGate = ({
  enabled = true,
  yieldDto,
}: {
  readonly enabled?: boolean;
  readonly yieldDto: EarnYieldWithProvider | null;
}) => {
  const { address } = useSKWallet();
  const selectedYield = yieldDto;
  const queryEnabled =
    enabled &&
    !!selectedYield &&
    !!address &&
    selectedYield.mechanics.requirements?.kycRequired === true;
  const yieldId = selectedYield?.id ?? null;
  const resource = yieldKycStatusAtom(
    new YieldKycKey({ address, enabled: queryEnabled, yieldId })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
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
