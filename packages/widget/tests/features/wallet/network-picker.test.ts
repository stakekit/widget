import { avalanche, mainnet, polygon, sepolia } from "viem/chains";
import { describe, expect, it } from "vitest";

import {
  type NetworkPickerGroup,
  networkPickerGroups,
} from "../../../src/features/wallet/model/network-picker";

const chains = [polygon, sepolia, mainnet, avalanche];

const ids = (groups: ReadonlyArray<NetworkPickerGroup>) =>
  groups.map((group) => [group.kind, group.chains.map((chain) => chain.id)]);

describe("networkPickerGroups", () => {
  it("lists the connected network, then the networks, then the testnets", () => {
    expect(
      ids(
        networkPickerGroups({ chains, currentChainId: mainnet.id, query: "" })
      )
    ).toEqual([
      ["Current", [mainnet.id]],
      ["Networks", [polygon.id, avalanche.id]],
      ["Testnets", [sepolia.id]],
    ]);
  });

  it("leaves out groups with no network, such as on an unsupported network", () => {
    expect(
      ids(
        networkPickerGroups({
          chains: [polygon, avalanche],
          currentChainId: null,
          query: "",
        })
      )
    ).toEqual([["Networks", [polygon.id, avalanche.id]]]);
  });

  it("filters by name, ignoring case and surrounding spaces", () => {
    expect(
      ids(
        networkPickerGroups({
          chains,
          currentChainId: mainnet.id,
          query: " POLY ",
        })
      )
    ).toEqual([["Networks", [polygon.id]]]);
    expect(
      networkPickerGroups({ chains, currentChainId: mainnet.id, query: "zzz" })
    ).toEqual([]);
  });
});
