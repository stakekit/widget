import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import { EitherAsync, Maybe } from "purify-ts";
import portoIcon from "../../assets/images/porto.svg";
import { evmChainGroup } from "../../domain/types/chains";
import { type EvmChainsMap, evmChainsMap } from "../../domain/types/chains/evm";
import type { Networks } from "../../domain/types/chains/networks";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import type { VariantProps } from "../settings/types";
import { createFineryWallets } from "./finery-wallet-list";
import { passCorrectChainsToWallet } from "./utils";

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
  institutionalWallets,
  variant,
}: {
  enabledNetworks: ReadonlySet<Networks>;
  forceWalletConnectOnly: boolean;
  institutionalWallets: boolean;
  variant: VariantProps["variant"];
}): Promise<{
  evmChainsMap: Partial<EvmChainsMap>;
  evmChains: Chain[];
  connector: Maybe<WalletList[number]>;
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
    connector: Maybe.fromPredicate(() => !!evmChains.length, connector),
    institutionalWallets:
      variant === "finery" || institutionalWallets
        ? createFineryWallets(evmChains)
        : null,
  };
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() => queryFn(opts)).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get evm config");
  });
