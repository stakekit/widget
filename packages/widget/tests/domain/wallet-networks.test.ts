import { describe, expect, expectTypeOf, it } from "vitest";
import {
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
  type SupportedSKChainIds,
  type WalletNetwork as WalletNetworkContract,
} from "../../src/domain/wallet/contract";
import {
  getProtocolChainIdentity,
  getWalletProtocolFamily,
  getWalletRoutingId,
  isWalletNetwork,
  WalletNetwork,
  walletCosmosNetworks,
} from "../../src/domain/wallet/network";
import {
  EvmChainIds as PublicEvmChainIds,
  MiscChainIds as PublicMiscChainIds,
  SubstrateChainIds as PublicSubstrateChainIds,
  type SupportedSKChainIds as PublicSupportedSKChainIds,
} from "../../src/public-api/types";
import { miscChainsMap } from "../../src/services/wallet/internal/adapters/configured-chains";
import { getRegistryIdsToSKCosmosNetworks } from "../../src/services/wallet/internal/adapters/cosmos/chains/get-chain-registry";
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
  it("publishes exhaustive wallet Domain chain-ID constants", () => {
    expect(PublicEvmChainIds).toBe(EvmChainIds);
    expect(PublicSubstrateChainIds).toBe(SubstrateChainIds);
    expect(PublicMiscChainIds).toBe(MiscChainIds);
    expect(EvmChainIds).not.toHaveProperty(String(EvmChainIds.Arbitrum));
    expect(SubstrateChainIds).not.toHaveProperty(
      String(SubstrateChainIds.Polkadot)
    );
    expect(MiscChainIds).not.toHaveProperty(String(MiscChainIds.Solana));
    expect(MiscChainIds).not.toHaveProperty("Stellar");
    expect(MiscChainIds).not.toHaveProperty("StellarTestnet");
    expectTypeOf<
      Extract<keyof typeof EvmChainIds, number>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof typeof SubstrateChainIds, number>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof typeof MiscChainIds, number>
    >().toEqualTypeOf<never>();
    expectTypeOf<EvmChainIds>().toMatchTypeOf<SupportedSKChainIds>();
    expectTypeOf<42_162>().not.toMatchTypeOf<SupportedSKChainIds>();
    expectTypeOf<PublicSupportedSKChainIds>().toEqualTypeOf<SupportedSKChainIds>();
  });

  it("projects routing and native identity facts from every Wallet Network", () => {
    expectTypeOf<
      typeof WalletNetwork.Type
    >().toEqualTypeOf<WalletNetworkContract>();
    expect(WalletNetwork.literals).toHaveLength(70);
    expect(WalletNetwork.literals).not.toContain("stellar-testnet");
    expect(isWalletNetwork("stellar-testnet")).toBe(false);
    expect(getWalletRoutingId("arbitrum")).toBe(42_161);
    expect(getProtocolChainIdentity("arbitrum")).toEqual({
      type: "evm",
      chainId: 42_161,
    });
    expect(getWalletRoutingId("cosmos")).toBe("cosmoshub-4");
    expect(getProtocolChainIdentity("cosmos")).toEqual({
      type: "cosmos",
      chainId: "cosmoshub-4",
    });
    expect(getWalletRoutingId("polkadot")).toBe(9999);
    expect(getProtocolChainIdentity("polkadot")).toEqual({
      type: "substrate",
      genesisHash:
        "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
    });
    expect(getWalletRoutingId("solana")).toBe(501);
    expect(getProtocolChainIdentity("solana")).toEqual({
      type: "unmodelled",
    });
    expect(getWalletProtocolFamily("solana")).toBe("solana");
    expect(getWalletRoutingId("stellar")).toBe(148);
    expect(getProtocolChainIdentity("stellar")).toEqual({
      type: "stellar",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    expect(getWalletProtocolFamily("stellar")).toBe("stellar");

    expect(
      WalletNetwork.literals.map((network) => getWalletProtocolFamily(network))
    ).not.toContain("misc");
    expect(walletCosmosNetworks).toContain("mantra");
  });

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
    const publicIds = declaredChainIds(MiscChainIds);
    const adapterIds = adapterChainIds(miscChainsMap);

    expect(
      Object.fromEntries(
        Object.entries(adapterIds).filter(([name]) => name in publicIds)
      )
    ).toEqual(publicIds);
  });

  it("uses Wallet Routing IDs in adapter chain metadata", () => {
    const adapterChains = {
      ...evmChainsMap,
      ...miscChainsMap,
      ...substrateChainsMap,
    };

    for (const [network, configuration] of Object.entries(adapterChains)) {
      expect(configuration.wagmiChain.id).toBe(
        getWalletRoutingId(network as keyof typeof adapterChains)
      );
    }
    expect(miscChainsMap.solana.protocolFamily).toBe("solana");
  });

  it("derives Cosmos registry reverse lookups from native identities", () => {
    const registryIdsToNetworks = getRegistryIdsToSKCosmosNetworks();

    expect(Object.keys(registryIdsToNetworks)).toHaveLength(
      walletCosmosNetworks.length
    );
    for (const network of walletCosmosNetworks) {
      const identity = getProtocolChainIdentity(network);
      expect(registryIdsToNetworks[identity.chainId]).toBe(network);
    }
  });
});
