import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigFieldAtom } from "../../../app/config/settings";
import type { ValidatorsConfig } from "../../../domain/earn/yield";
import type { SupportedSKChains } from "../../../services/wallet/supported-chains";

export const validatorsConfigAtom = Atom.make((get) => {
  const validatorsConfig = get(widgetConfigFieldAtom("validatorsConfig"));

  return new Map(
    Object.entries(validatorsConfig ?? {}).map(([key, val]) => [
      key as SupportedSKChains,
      {
        allowed: val.allowed && new Set(val.allowed),
        blocked: val.blocked && new Set(val.blocked),
        preferred: val.preferred && new Set(val.preferred),
        mergePreferredWithDefault: val.mergePreferredWithDefault ?? true,
        preferredOnly: val.preferredOnly ?? false,
      },
    ])
  ) satisfies ValidatorsConfig;
}).pipe(Atom.withLabel("validatorsConfigAtom"));
