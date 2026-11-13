import { describe, expect, it } from "@effect/vitest";

import type { CosmosChainsMap } from "../../../src/services/wallet/internal/adapters/cosmos/chains";
import { getWalletManager } from "../../../src/services/wallet/internal/adapters/cosmos/wallet-manager";
import type { WalletConnectProtocol } from "../../../src/services/wallet/internal/platform/wallet-connect-protocol";
import { runWalletEffect } from "../../utils/run-wallet-effect";

const entry = (network: string, chainId: string, chainName: string) => ({
  type: "cosmos",
  network,
  wagmiChain: {
    id: chainId,
    name: chainName,
    nativeCurrency: { name: chainName, symbol: chainName, decimals: 6 },
    rpcUrls: { default: { http: [""] } },
  },
  chain: { chain_id: chainId, chain_name: chainName },
});

const managerChainNames = (cosmosChainsMap: Partial<CosmosChainsMap>) =>
  getWalletManager({
    cosmosChainsMap,
    persistPublicKey: async () => {},
    runWalletEffect,
    walletConnectProtocol: {} as WalletConnectProtocol,
  }).walletManager.chainRecords.map((record) => record.name);

describe("Cosmos wallet manager", () => {
  it("lists Cosmos Hub first and keeps the other chains in their order", () => {
    const cosmosChainsMap = {
      osmosis: entry("osmosis", "osmosis-1", "osmosis"),
      juno: entry("juno", "juno-1", "juno"),
      cosmos: entry("cosmos", "cosmoshub-4", "cosmoshub"),
      akash: entry("akash", "akashnet-2", "akash"),
      kava: entry("kava", "kava_2222-10", "kava"),
    } as unknown as Partial<CosmosChainsMap>;

    expect(managerChainNames(cosmosChainsMap)).toEqual([
      "cosmoshub",
      "osmosis",
      "juno",
      "akash",
      "kava",
    ]);
  });
});
