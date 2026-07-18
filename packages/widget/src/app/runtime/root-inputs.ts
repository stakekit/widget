import * as Atom from "effect/unstable/reactivity/Atom";
import type { SupportedSKChainIds } from "../../domain/types/chains";
import type { SKExternalProviders } from "../../public-api/types";
import { selectAtom } from "../../shared/effect/select-atom";
import { widgetConfigAtom } from "../config/settings";

export type DynamicExternalProviderInput = {
  readonly currentAddress: string;
  readonly currentChain: SupportedSKChainIds | null;
  readonly provider: SKExternalProviders["provider"];
  readonly supportedChainIds: ReadonlyArray<SupportedSKChainIds> | null;
  readonly type: "generic";
} | null;

export const normalizeDynamicExternalProviderInput = (
  externalProviders: SKExternalProviders | undefined
): DynamicExternalProviderInput =>
  externalProviders
    ? {
        currentAddress: externalProviders.currentAddress,
        currentChain: externalProviders.currentChain ?? null,
        provider: externalProviders.provider,
        supportedChainIds: externalProviders.supportedChainIds
          ? [...new Set(externalProviders.supportedChainIds)].sort(
              (first, second) => first - second
            )
          : null,
        type: externalProviders.type,
      }
    : null;

export const dynamicExternalProviderInputAtom = selectAtom(
  widgetConfigAtom,
  (settings) =>
    normalizeDynamicExternalProviderInput(settings.externalProviders)
).pipe(Atom.withLabel("dynamicExternalProviderInputAtom"));
