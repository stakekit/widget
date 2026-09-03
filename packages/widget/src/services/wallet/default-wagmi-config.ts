import type { Chain as RainbowkitChain } from "@stakekit/rainbowkit";
import { createClient } from "viem";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const omitEnsUniversalResolver = <T extends RainbowkitChain>(
  chain: T
): T => {
  if (!chain.contracts?.ensUniversalResolver) return chain;

  const { ensUniversalResolver: _ensUniversalResolver, ...contracts } =
    chain.contracts;

  return { ...chain, contracts } as T;
};

export const makeDefaultConfig = () =>
  createConfig({
    chains: [omitEnsUniversalResolver(mainnet)],
    client: ({ chain }) =>
      createClient({
        chain,
        transport: http(chain.rpcUrls.default.http.find((url) => !!url)),
      }),
  });
