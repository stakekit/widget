import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../resources/yield-insights";

export const useYieldKycGate = ({
  enabled = true,
  yieldDto,
}: {
  readonly enabled?: boolean;
  readonly yieldDto: EarnYieldWithProvider | null;
}) => {
  const key = new CurrentYieldKycGateKey({
    enabled,
    yieldDto,
  });

  const gate = useAtomValue(currentYieldKycGateAtom(key));
  const refresh = useAtomSet(refreshCurrentYieldKycAtom(key));

  return { ...gate, refetch: () => refresh(undefined) } as const;
};
