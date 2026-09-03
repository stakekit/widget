import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import { Effect, Record } from "effect";
import type { Network } from "../../../../../domain/network/network";
import type { VariantProps } from "../../../../../public-api/react-types";
import { evmChainGroup } from "../../../../../services/wallet/evm-chain-group";
import portoIcon from "../../../../../shared/assets/images/porto.svg";
import { WalletIntegrationError } from "../../../wallet-errors";
import { type EvmChainsMap, evmChainsMap } from "./chains";
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
  const filteredEvmChainsMap: Partial<EvmChainsMap> = Record.filter(
    evmChainsMap,
    (v) => enabledNetworks.has(v.network)
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

  const getConfiguredWallets = (): WalletList[number]["wallets"] => {
    if (variant === "porto") return [portoWallet];
    if (forceWalletConnectOnly) return [walletConnectWallet];
    return [
      metaMaskWallet,
      injectedWallet,
      walletConnectWallet,
      coinbaseWallet,
      ledgerWallet,
    ];
  };
  const configuredWallets = getConfiguredWallets();

  const wallets: WalletList[number]["wallets"] = configuredWallets
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
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get evm config",
        operation: "evm-config",
      }),
  });
