import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { config } from "../../config";
import { ethereumChainGroup } from "../../domain/types/chains";
import { type EvmChainsMap, evmChainsMap } from "../../domain/types/chains/evm";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import type { VariantProps } from "../settings/types";
import { createFineryWallets } from "./finery-wallet-list";
import { passCorrectChainsToWallet } from "./utils";

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
  variant,
}: {
  queryClient: QueryClient;
  forceWalletConnectOnly: boolean;
  variant: VariantProps["variant"];
}): Promise<{
  evmChainsMap: Partial<EvmChainsMap>;
  evmChains: Chain[];
  connector: Maybe<WalletList[number]>;
  fineryWallets: ReturnType<typeof createFineryWallets> | null;
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
        wallets: (forceWalletConnectOnly
          ? [walletConnectWallet]
          : [
              metaMaskWallet,
              injectedWallet,
              walletConnectWallet,
              rainbowWallet,
              coinbaseWallet,
              ledgerWallet,
            ]
        )
          .map((w) => passCorrectChainsToWallet(w, evmChains))
          .map((w) => (props) => ({
            ...w(props),
            chainGroup: ethereumChainGroup,
          })),
      };

      return Promise.resolve({
        evmChainsMap: filteredEvmChainsMap,
        evmChains,
        connector: Maybe.fromPredicate(() => !!evmChains.length, connector),
        fineryWallets:
          variant === "finery" ? createFineryWallets(evmChains) : null,
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
