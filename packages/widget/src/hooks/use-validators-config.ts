import { useMemo } from "react";
import type { SupportedSKChains } from "../domain/types/chains";
import type { ValidatorsConfig } from "../domain/types/yields";
import { useSettings } from "../providers/settings";

export const useValidatorsConfig = (): ValidatorsConfig => {
  const { validatorsConfig } = useSettings();

  return useMemo(
    () =>
      new Map(
        Object.entries(validatorsConfig ?? {}).map(([key, val]) => [
          key as SupportedSKChains,
          {
            allowed: val.allowed && new Set(val.allowed),
            blocked: val.blocked && new Set(val.blocked),
            preferred: val.preferred && new Set(val.preferred),
            mergePreferredWithDefault: val.mergePreferredWithDefault ?? true,
          },
        ])
      ),
    [validatorsConfig]
  );
};
