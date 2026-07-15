import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import { Effect } from "effect";
import type { Network } from "../../../../domain/schema/network-model";
import { evmChainGroup } from "../../../../domain/types/chains";
import {
  type EvmChainsMap,
  evmChainsMap,
} from "../../../../domain/types/chains/evm";
import type { VariantProps } from "../../../../public-api/types";
import portoIcon from "../../../../shared/assets/images/porto.svg";
import {
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../../../shared/lib/object";
import { createFineryWallets } from "./finery-wallet-list";
import { passCorrectChainsToWallet } from "./utils";

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
  institutionalWallets,
  variant,
}: {
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
  institutionalWallets: boolean;
  variant: VariantProps["variant"];
}): Promise<{
  evmChainsMap: Partial<EvmChainsMap>;
  evmChains: Chain[];
  connector: WalletList[number] | null;
  institutionalWallets: ReturnType<typeof createFineryWallets> | null;
}> => {
  const filteredEvmChainsMap: Partial<EvmChainsMap> = typeSafeObjectFromEntries(
    typeSafeObjectEntries<EvmChainsMap>(evmChainsMap).filter(([_, v]) =>
      enabledNetworks.has(v.skChainName)
    )
  );

  const evmChains = Object.values(filteredEvmChainsMap).map(
    (val) => val.wagmiChain
  );

  const portoWallet: WalletList[number]["wallets"][number] = (args) => ({
    ...walletConnectWallet(args),
    iconUrl: portoIcon,
    iconBackground: "#000",
    name: "Porto",
  });

  const wallets: WalletList[number]["wallets"] = (
    variant === "porto"
      ? [portoWallet]
      : forceWalletConnectOnly
        ? [walletConnectWallet]
        : [
            metaMaskWallet,
            injectedWallet,
            walletConnectWallet,
            coinbaseWallet,
            ledgerWallet,
          ]
  )
    .map((w) => passCorrectChainsToWallet(w, evmChains))
    .map((w) => (props) => ({ ...w(props), chainGroup: evmChainGroup }));

  const connector: WalletList[number] = {
    groupName: "Ethereum",
    wallets,
  };

  return {
    evmChainsMap: filteredEvmChainsMap,
    evmChains,
    connector: evmChains.length > 0 ? connector : null,
    institutionalWallets:
      variant === "finery" || institutionalWallets
        ? createFineryWallets(evmChains)
        : null,
  };
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  Effect.tryPromise({
    try: () => queryFn(opts),
    catch: (error) => new Error("Could not get evm config", { cause: error }),
  });
