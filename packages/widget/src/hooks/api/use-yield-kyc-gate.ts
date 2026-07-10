import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Maybe } from "purify-ts";
import { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import { isKycGateBlocking, mapKycStatusToGate } from "../../domain/types/kyc";
import type { Yield } from "../../domain/types/yields";
import { useSKWallet } from "../../providers/sk-wallet";
import { YieldKycKey, yieldKycStatusAtom } from "./dashboard-atoms";

export const useYieldKycGate = ({
  enabled = true,
  yieldDto,
}: {
  readonly enabled?: boolean;
  readonly yieldDto: Maybe<Yield>;
}) => {
  const { address: rawAddress } = useSKWallet();
  const selectedYield = yieldDto.extractNullable();
  const queryEnabled =
    enabled &&
    !!selectedYield &&
    !!rawAddress &&
    selectedYield.mechanics.requirements?.kycRequired === true;
  const address = rawAddress
    ? Schema.decodeUnknownSync(WalletAddress)(rawAddress)
    : null;
  const yieldId = selectedYield
    ? Schema.decodeUnknownSync(YieldId)(selectedYield.id)
    : null;
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
