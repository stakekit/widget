import { describe, expect, it } from "vitest";
import {
  EvmChainIds,
  evmChainsMap,
  supportedEVMChainsSet,
} from "../../src/domain/types/chains/evm";
import { EvmNetworks } from "../../src/domain/types/chains/networks";

describe("EVM chains", () => {
  it("configures Pharos with PROS as its native gas token", () => {
    expect(supportedEVMChainsSet.has(EvmNetworks.Pharos)).toBe(true);
    expect(EvmChainIds.Pharos).toBe(1672);
    expect(evmChainsMap[EvmNetworks.Pharos]).toMatchObject({
      type: "evm",
      skChainName: "pharos",
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
