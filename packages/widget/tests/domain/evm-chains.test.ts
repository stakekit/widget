import { describe, expect, it } from "vitest";
import { EvmChainIds } from "../../src/public-api/types";
import { evmChainsMap } from "../../src/services/wallet/internal/adapters/evm/chains";

describe("EVM chains", () => {
  it("configures Robinhood mainnet and testnet", () => {
    expect(EvmChainIds.Robinhood).toBe(4663);
    expect(EvmChainIds.RobinhoodTestnet).toBe(46_630);
    expect(evmChainsMap.robinhood).toMatchObject({
      type: "evm",
      network: "robinhood",
      wagmiChain: {
        id: 4663,
        name: "Robinhood Chain",
        iconUrl: "https://assets.stakek.it/networks/robinhood.svg",
        nativeCurrency: {
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://rpc.mainnet.chain.robinhood.com"],
          },
        },
        blockExplorers: {
          default: {
            url: "https://robinhoodchain.blockscout.com",
          },
        },
      },
    });
    expect(evmChainsMap.robinhood.wagmiChain.testnet).toBeUndefined();

    expect(evmChainsMap["robinhood-testnet"]).toMatchObject({
      type: "evm",
      network: "robinhood-testnet",
      wagmiChain: {
        id: 46_630,
        name: "Robinhood Chain Testnet",
        iconUrl: "https://assets.stakek.it/networks/robinhood-testnet.svg",
        nativeCurrency: {
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://rpc.testnet.chain.robinhood.com"],
          },
        },
        blockExplorers: {
          default: {
            url: "https://explorer.testnet.chain.robinhood.com",
          },
        },
        testnet: true,
      },
    });
  });

  it("configures Pharos with PROS as its native gas token", () => {
    expect(EvmChainIds.Pharos).toBe(1672);
    expect(evmChainsMap.pharos).toMatchObject({
      type: "evm",
      network: "pharos",
      wagmiChain: {
        id: 1672,
        name: "Pharos",
        nativeCurrency: {
          name: "PROS",
          symbol: "PROS",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://rpc.pharos.xyz"],
          },
        },
        blockExplorers: {
          default: {
            name: "Pharos Explorer",
            url: "https://pharosscan.xyz",
          },
        },
      },
    });
  });
});
