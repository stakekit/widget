type NonEmptyReadonlyArray<A> = readonly [A, ...A[]];

export const intersectNetworkLiterals = <
  const LegacyNetworks extends NonEmptyReadonlyArray<string>,
  const YieldNetworks extends NonEmptyReadonlyArray<string>,
>(
  legacyNetworks: LegacyNetworks,
  yieldNetworks: YieldNetworks
): NonEmptyReadonlyArray<
  Extract<LegacyNetworks[number], YieldNetworks[number]>
> => {
  const yieldNetworkSet = new Set<string>(yieldNetworks);
  const commonNetworks = legacyNetworks.filter(
    (
      network
    ): network is Extract<LegacyNetworks[number], YieldNetworks[number]> =>
      yieldNetworkSet.has(network)
  );
  const firstNetwork = commonNetworks[0];

  if (firstNetwork === undefined) {
    throw new Error("Legacy and Yield Networks have no shared values");
  }

  return [firstNetwork, ...commonNetworks.slice(1)];
};
