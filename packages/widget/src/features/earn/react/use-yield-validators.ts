import { useAtom, useAtomRefresh } from "@effect/atom-react";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { Network } from "../../../domain/schema/network-model";
import {
  YieldValidatorsKey,
  yieldValidatorsPullAtom,
} from "../resources/yield-validators";

export const useYieldValidators = ({
  yieldId,
  network,
  search,
  enabled = true,
}: {
  enabled?: boolean;
  yieldId?: YieldId;
  network?: Network;
  search?: string;
}) => {
  const key = new YieldValidatorsKey({
    network: network ?? null,
    search: search?.trim() || null,
    yieldId: enabled ? (yieldId ?? null) : null,
  });
  const resource = yieldValidatorsPullAtom(key);
  const [result, pull] = useAtom(resource);
  const refresh = useAtomRefresh(resource);

  return { pull, refresh, result } as const;
};
