import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { config } from "../../config";
import { type EvmChainsMap, evmChainsMap } from "../../domain/types/chains/evm";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import type { VariantProps } from "../settings/types";

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
}: {
  queryClient: QueryClient;
  forceWalletConnectOnly: boolean;
  variant: VariantProps["variant"];
}): Promise<{
  evmChainsMap: Partial<EvmChainsMap>;
  evmChains: Chain[];
  connector: Maybe<WalletList[number]>;
}> =>
  getEnabledNetworks({ queryClient }).caseOf({
    Right: (networks) => {
      const filteredEvmChainsMap: Partial<EvmChainsMap> =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<EvmChainsMap>(evmChainsMap).filter(([_, v]) =>
            networks.has(v.skChainName)
          )
        );

      const evmChains = Object.values(filteredEvmChainsMap).map(
        (val) => val.wagmiChain
      );

      const connector: WalletList[number] = {
        groupName: "Ethereum",
        wallets: forceWalletConnectOnly
          ? [walletConnectWallet]
          : [
              metaMaskWallet,
              injectedWallet,
              walletConnectWallet,
              rainbowWallet,
              coinbaseWallet,
            ],
      };

      return Promise.resolve({
        evmChainsMap: filteredEvmChainsMap,
        evmChains,
        connector: Maybe.fromPredicate(() => !!evmChains.length, connector),
      });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: [config.appPrefix, "evm-config"],
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get evm config");
  });
