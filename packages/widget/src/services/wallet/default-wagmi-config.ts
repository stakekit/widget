import { createClient } from "viem";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import type { Chain as WalletChain } from "./wallet-descriptors";

export const omitEnsUniversalResolver = (chain: WalletChain): WalletChain => {
  if (!chain.contracts?.ensUniversalResolver) return chain;

  const { ensUniversalResolver: _ensUniversalResolver, ...contracts } =
    chain.contracts;

  return { ...chain, contracts };
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
