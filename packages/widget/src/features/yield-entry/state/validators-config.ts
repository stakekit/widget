import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/runtime/widget-config";
import type { ValidatorsConfig } from "../../../domain/earn/yield";
import type { SupportedSKChains } from "../../../services/wallet/supported-chains";

export const validatorsConfigAtom = Atom.make((get) => {
  const validatorsConfig = get(widgetConfigAtom).validatorsConfig;

  return new Map(
    Object.entries(validatorsConfig).map(([key, val]) => [
      key as SupportedSKChains,
      {
        allowed: val.allowed && new Set(val.allowed),
        blocked: val.blocked && new Set(val.blocked),
        preferred: val.preferred && new Set(val.preferred),
        mergePreferredWithDefault: val.mergePreferredWithDefault,
        preferredOnly: val.preferredOnly,
      },
    ])
  ) satisfies ValidatorsConfig;
}).pipe(Atom.withLabel("validatorsConfigAtom"));
