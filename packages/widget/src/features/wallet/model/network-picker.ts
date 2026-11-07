import type { Chain } from "../../../services/wallet/wallet-descriptors";

/**
 * A titled run of the network picker: the connected network, the networks
 * and the testnets, by viem's `testnet` flag.
 */
export type NetworkPickerGroup = Readonly<{
  kind: "Current" | "Networks" | "Testnets";
  chains: ReadonlyArray<Chain>;
}>;

/**
 * The network picker's groups of the `chains` whose name holds `query`,
 * ignoring case, in the order given; a group with no network is left out.
 */
export const networkPickerGroups = ({
  chains,
  currentChainId,
  query,
}: Readonly<{
  chains: ReadonlyArray<Chain>;
  currentChainId: number | null;
  query: string;
}>): ReadonlyArray<NetworkPickerGroup> => {
  const needle = query.trim().toLocaleLowerCase();
  const matches = chains.filter((chain) =>
    chain.name.toLocaleLowerCase().includes(needle)
  );
  const others = matches.filter((chain) => chain.id !== currentChainId);
  const groups: ReadonlyArray<NetworkPickerGroup> = [
    {
      kind: "Current",
      chains: matches.filter((chain) => chain.id === currentChainId),
    },
    {
      kind: "Networks",
      chains: others.filter((chain) => chain.testnet !== true),
    },
    {
      kind: "Testnets",
      chains: others.filter((chain) => chain.testnet === true),
    },
  ];
  return groups.filter((group) => group.chains.length > 0);
};
