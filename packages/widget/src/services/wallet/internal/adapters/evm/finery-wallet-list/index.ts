import { createStore } from "mipd";
import type { EIP1193Provider } from "viem";
import { injected } from "wagmi";
import { evmChainGroup } from "../../../../../../services/wallet/evm-chain-group";
import type { Chain, WalletList } from "../../../../wallet-descriptors";
import safeWalletIcon from "../icons/safe-wallet.svg";
import {
  announcedWalletAvailability,
  failWhenProviderMissing,
} from "../injected-availability";
import { passCorrectChainsToWallet } from "../utils";
import { coinbaseWallet, type EvmWallets, injectedWallet } from "../wallets";
import bitGoIcon from "./custom-wallet-icons/bitgo.svg";
import { cactusIcon } from "./custom-wallet-icons/cactus-icon";
import finoaIcon from "./custom-wallet-icons/finoa.svg";
import { fireblocksIcon } from "./custom-wallet-icons/fireblocks-icon";
import { mpcVaultIcon } from "./custom-wallet-icons/mpcvault-icon";
import utilIcon from "./custom-wallet-icons/utila.svg";

type CommonWalletOptions = Pick<
  ReturnType<WalletList[number]["wallets"][number]>,
  "iconUrl" | "id" | "name" | "rdns" | "iconBackground" | "chainGroup"
>;

const bitgoWallet: CommonWalletOptions = {
  iconUrl: bitGoIcon,
  id: "bitgo",
  name: "BitGo",
  rdns: "com.bitgo.wallet",
  iconBackground: "#010E1B",
  chainGroup: evmChainGroup,
};

const fireblocksWallet: CommonWalletOptions = {
  iconUrl: fireblocksIcon,
  id: "fireblocks",
  name: "Fireblocks",
  rdns: "com.fireblocks.wallet",
  iconBackground: "#131A2D",
  chainGroup: evmChainGroup,
};

const cactusWallet: CommonWalletOptions = {
  iconUrl: cactusIcon,
  id: "cactus",
  name: "Cactus",
  rdns: "com.cactus.wallet",
  iconBackground: "#FFF",
  chainGroup: evmChainGroup,
};

const mpcVaultWallet: CommonWalletOptions = {
  iconUrl: mpcVaultIcon,
  id: "mpc-vault",
  name: "MPC Vault",
  rdns: "com.mpcvault.wallet",
  iconBackground: "#1A1A1A",
  chainGroup: evmChainGroup,
};

const utilaWallet: CommonWalletOptions = {
  iconUrl: utilIcon,
  id: "utila",
  name: "Utila",
  rdns: "com.utila.wallet",
  iconBackground: "#FFF",
  chainGroup: evmChainGroup,
};

const finoaWallet: CommonWalletOptions = {
  iconUrl: finoaIcon,
  id: "finoa",
  name: "Finoa",
  rdns: "com.finoa.wallet",
  iconBackground: "#FFF",
  chainGroup: evmChainGroup,
};

const safeWalletWC: CommonWalletOptions = {
  iconUrl: safeWalletIcon,
  id: "safe",
  name: "Safe",
  rdns: "app.safe",
  iconBackground: "#12FF80",
  chainGroup: evmChainGroup,
};

const asEip1193Provider = (
  provider: Record<string, unknown> | undefined
): EIP1193Provider | undefined => provider as EIP1193Provider | undefined;

export const createFineryWallets = (
  evmChains: Chain[],
  wallets: EvmWallets
): {
  primaryWallets: WalletList[number]["wallets"];
  otherWallets: WalletList[number]["wallets"];
} => {
  // Institutional extensions announce themselves over EIP-6963; the store keeps
  // listening, so detection sees extensions that appear after bootstrap.
  const store = createStore();
  const announcedProvider = (rdns: string) =>
    asEip1193Provider(store.findProvider({ rdns })?.provider);

  const institutionalExtension =
    ({
      icon,
      id,
      installUrl,
      name,
      rdns,
      wallet,
    }: {
      readonly icon: string;
      readonly id: string;
      readonly installUrl: string;
      readonly name: string;
      readonly rdns: string;
      readonly wallet: CommonWalletOptions;
    }): WalletList[number]["wallets"][number] =>
    () => ({
      ...wallet,
      id,
      name: store.findProvider({ rdns })?.info.name ?? name,
      rdns,
      availability: announcedWalletAvailability({ installUrl, rdns, store }),
      createConnector: (walletDetails) => (config) => ({
        ...walletDetails,
        ...failWhenProviderMissing(
          id,
          injected({
            target: {
              id,
              name,
              provider: () => announcedProvider(rdns),
              icon: store.findProvider({ rdns })?.info.icon ?? icon,
            },
          })
        )(config),
      }),
    });

  const fireblocksExtWallet = institutionalExtension({
    icon: fireblocksIcon,
    id: "fireblocks",
    installUrl:
      "https://chromewebstore.google.com/detail/fireblocks-defi-extension/mpmfkenmdhemcjnkfndoiagglhpenolg",
    name: "Fireblocks",
    rdns: "com.fireblocks",
    wallet: fireblocksWallet,
  });
  const mpcVaultExtWallet = institutionalExtension({
    icon: mpcVaultIcon,
    id: "mpcvaultPlugin",
    installUrl:
      "https://chromewebstore.google.com/detail/mpcvault/jgfmfplofjigjfokigdiaiibhonfnedj",
    name: "MPCVault",
    rdns: "com.mpcvault.console",
    wallet: mpcVaultWallet,
  });
  const cactusLinkWallet = institutionalExtension({
    icon: cactusIcon,
    id: "cactusLink",
    installUrl:
      "https://chromewebstore.google.com/detail/cactus-link/chiilpgkfmcopocdffapngjcbggdehmj",
    name: "Cactus Link",
    rdns: "com.mycactus",
    wallet: cactusWallet,
  });

  const fineryWCWallets: WalletList[number]["wallets"] = [
    utilaWallet,
    finoaWallet,
    bitgoWallet,
    safeWalletWC,
  ].map((w) =>
    passCorrectChainsToWallet(
      (props) => ({
        ...wallets.walletConnectWallet(props),
        ...w,
        id: `${w.id}-wc`,
        rdns: `${w.rdns}-wc`,
      }),
      evmChains
    )
  );

  const primaryWallets: WalletList[number]["wallets"] = [
    ...[
      fireblocksExtWallet,
      mpcVaultExtWallet,
      cactusLinkWallet,
      wallets.ledgerWallet,
    ].map((w) => passCorrectChainsToWallet(w, evmChains)),
    ...fineryWCWallets,
  ];

  const otherWallets: WalletList[number]["wallets"] = [
    wallets.metaMaskWallet,
    wallets.walletConnectWallet,
    coinbaseWallet,
    injectedWallet,
  ].map((w) => passCorrectChainsToWallet(w, evmChains));

  return {
    primaryWallets,
    otherWallets,
  };
};
