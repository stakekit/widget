import { Array as EArray } from "effect";

export const intersectNetworkLiterals = <
  const LegacyNetworks extends EArray.NonEmptyReadonlyArray<string>,
  const YieldNetworks extends EArray.NonEmptyReadonlyArray<string>,
>(
  legacyNetworks: LegacyNetworks,
  yieldNetworks: YieldNetworks
): EArray.NonEmptyReadonlyArray<
  Extract<LegacyNetworks[number], YieldNetworks[number]>
> => {
  const yieldNetworkSet = new Set<string>(yieldNetworks);
  const commonNetworks = EArray.filter(
    legacyNetworks,
    (
      network
    ): network is Extract<LegacyNetworks[number], YieldNetworks[number]> =>
      yieldNetworkSet.has(network)
  );

  if (!EArray.isReadonlyArrayNonEmpty(commonNetworks)) {
    throw new Error("Legacy and Yield Networks have no shared values");
  }

  return commonNetworks;
};
