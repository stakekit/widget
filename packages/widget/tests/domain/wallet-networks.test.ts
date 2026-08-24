import { describe, expect, it } from "vitest";
import {
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
} from "../../src/public-api/types";
import { miscChainsMap } from "../../src/services/wallet/internal/adapters/configured-chains";
import { evmChainsMap } from "../../src/services/wallet/internal/adapters/evm/chains";
import { substrateChainsMap } from "../../src/services/wallet/internal/adapters/substrate/chains";

const enumName = (network: string) =>
  network
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const adapterChainIds = (
  chains: Record<string, { readonly wagmiChain: { readonly id: number } }>
) =>
  Object.fromEntries(
    Object.entries(chains).map(([network, chain]) => [
      enumName(network),
      chain.wagmiChain.id,
    ])
  );

const declaredChainIds = (chainIds: Record<string, string | number>) =>
  Object.fromEntries(
    Object.entries(chainIds).filter(([, value]) => typeof value === "number")
  );

describe("Wallet Network chain IDs", () => {
  it("keeps EVM public IDs aligned with adapter metadata", () => {
    expect(adapterChainIds(evmChainsMap)).toEqual(
      declaredChainIds(EvmChainIds)
    );
  });

  it("keeps Substrate public IDs aligned with adapter metadata", () => {
    expect(adapterChainIds(substrateChainsMap)).toEqual(
      declaredChainIds(SubstrateChainIds)
    );
  });

  it("keeps miscellaneous public IDs aligned with adapter metadata", () => {
    expect(adapterChainIds(miscChainsMap)).toEqual(
      declaredChainIds(MiscChainIds)
    );
  });
});
