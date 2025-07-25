import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  safeWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import { createStore } from "mipd";
import { Maybe } from "purify-ts";
import { injected } from "wagmi";
import { MaybeWindow } from "../../../utils/maybe-window";
import { passCorrectChainsToWallet } from "../utils";
import bitGoIcon from "./custom-wallet-icons/bitgo.svg";
import { cactusIcon } from "./custom-wallet-icons/cactus-icon";
// import { copperIcon } from "./custom-wallet-icons/copper-icon";
import finoaIcon from "./custom-wallet-icons/finoa.svg";
import { fireblocksIcon } from "./custom-wallet-icons/fireblocks-icon";
import { mpcVaultIcon } from "./custom-wallet-icons/mpcvault-icon";
import utilIcon from "./custom-wallet-icons/utila.svg";

type CommonWalletOptions = Pick<
  ReturnType<WalletList[number]["wallets"][number]>,
  "iconUrl" | "id" | "name" | "rdns" | "iconBackground" | "downloadUrls"
>;

const bitgoWallet: CommonWalletOptions = {
  iconUrl: bitGoIcon,
  id: "bitgo",
  name: "BitGo",
  rdns: "com.bitgo.wallet",
  iconBackground: "#010E1B",
  downloadUrls: {
    qrCode: "https://www.bitgo.com/",
  },
};

const fireblocksWallet: CommonWalletOptions = {
  iconUrl: fireblocksIcon,
  id: "fireblocks",
  name: "Fireblocks",
  rdns: "com.fireblocks.wallet",
  iconBackground: "#131A2D",
  downloadUrls: {
    android:
      "https://play.google.com/store/apps/details?id=com.fireblocks.client",
    ios: "https://apps.apple.com/us/app/fireblocks/id1439296596",
    qrCode: "https://fireblocks.com/",
    browserExtension:
      "https://chromewebstore.google.com/detail/fireblocks-defi-extension/mpmfkenmdhemcjnkfndoiagglhpenolg",
    chrome:
      "https://chromewebstore.google.com/detail/fireblocks-defi-extension/mpmfkenmdhemcjnkfndoiagglhpenolg",
  },
};

const cactusWallet: CommonWalletOptions = {
  iconUrl: cactusIcon,
  id: "cactus",
  name: "Cactus",
  rdns: "com.cactus.wallet",
  iconBackground: "#FFF",
  downloadUrls: {
    chrome:
      "https://chromewebstore.google.com/detail/cactus-link/chiilpgkfmcopocdffapngjcbggdehmj",
    browserExtension:
      "https://chromewebstore.google.com/detail/cactus-link/chiilpgkfmcopocdffapngjcbggdehmj",
    qrCode: "https://mycactus.com/",
  },
};

const mpcVaultWallet: CommonWalletOptions = {
  iconUrl: mpcVaultIcon,
  id: "mpc-vault",
  name: "MPC Vault",
  rdns: "com.mpcvault.wallet",
  iconBackground: "#1A1A1A",
  downloadUrls: {
    ios: "https://apps.apple.com/us/app/mpcvault-multisig-wallet/id1622756458",
    android:
      "https://play.google.com/store/apps/details?id=com.mpcvault.mobileapp.android",
    chrome:
      "https://chromewebstore.google.com/detail/mpcvault/jgfmfplofjigjfokigdiaiibhonfnedj",
    browserExtension:
      "https://chromewebstore.google.com/detail/mpcvault/jgfmfplofjigjfokigdiaiibhonfnedj",
    qrCode: "https://mpcvault.com/",
  },
};

const utilaWallet: CommonWalletOptions = {
  iconUrl: utilIcon,
  id: "utila",
  name: "Utila",
  rdns: "com.utila.wallet",
  iconBackground: "#FFF",
  downloadUrls: {
    android: "https://play.google.com/store/apps/details?id=io.utila.app",
    ios: "https://apps.apple.com/us/app/utila/id6443589681",
    qrCode: "https://utila.io/",
  },
};

const finoaWallet: CommonWalletOptions = {
  iconUrl: finoaIcon,
  id: "finoa",
  name: "Finoa",
  rdns: "com.finoa.wallet",
  iconBackground: "#FFF",
  downloadUrls: {
    qrCode: "https://finoa.io/",
  },
};

// const copperConnectWallet: CommonWalletOptions = {
//   iconUrl: copperIcon,
//   id: "copperConnect",
//   name: "Copper Connect",
//   rdns: "com.copper.wallet",
//   iconBackground: "#1A1A1A",
//   downloadUrls: {
//     qrCode: "https://copper.co/",
//     chrome:
//       "https://chromewebstore.google.com/detail/copper-connect/pkklibkpnflbmahpcnpifnnooicnehnh",
//     browserExtension:
//       "https://chromewebstore.google.com/detail/copper-connect/pkklibkpnflbmahpcnpifnnooicnehnh",
//   },
// };

const safeWalletWC: CommonWalletOptions = Maybe.of(safeWallet())
  .map(
    (val) =>
      ({
        iconUrl: val.iconUrl,
        id: val.id,
        name: val.name,
        rdns: val.rdns,
        iconBackground: val.iconBackground,
        downloadUrls: {
          qrCode: "https://app.safe.global/",
        },
      }) satisfies CommonWalletOptions
  )
  .unsafeCoerce();

export const createFineryWallets: (evmChains: Chain[]) => {
  primaryWallets: WalletList[number]["wallets"];
  otherWallets: WalletList[number]["wallets"];
} = (evmChains: Chain[]) => {
  if (MaybeWindow.isNothing()) {
    return {
      primaryWallets: [],
      otherWallets: [],
    };
  }

  const store = createStore();

  const providers = store.getProviders();

  const {
    fireblocksProvider,
    // copperConnectProvider,
    mpcVaultProvider,
    cactusProvider,
  } = providers.reduce(
    (acc, p) => {
      if (p.info.rdns === "com.fireblocks") acc.fireblocksProvider = p;
      // if (p.info.rdns === "co.copper") acc.copperConnectProvider = p;
      if (p.info.rdns === "com.mpcvault.console") acc.mpcVaultProvider = p;
      if (p.info.rdns === "com.mycactus") acc.cactusProvider = p;
      return acc;
    },
    {
      fireblocksProvider: undefined,
      // copperConnectProvider: undefined,
      mpcVaultProvider: undefined,
      cactusProvider: undefined,
    } as {
      fireblocksProvider: (typeof providers)[number] | undefined;
      // copperConnectProvider: (typeof providers)[number] | undefined;
      mpcVaultProvider: (typeof providers)[number] | undefined;
      cactusProvider: (typeof providers)[number] | undefined;
    }
  );

  const cactusLinkWallet: WalletList[number]["wallets"][number] = () => ({
    ...cactusWallet,
    id: "cactusLink",
    name: cactusProvider?.info.name ?? "Cactus Link",
    rdns: cactusProvider?.info.rdns ?? "com.mycactus",
    installed: !!cactusProvider?.provider,
    createConnector: (rkDetails) => (config) => ({
      ...rkDetails,
      ...injected({
        target: {
          id: "cactusLink",
          name: "Cactus Link",
          provider: cactusProvider?.provider as typeof window.ethereum,
          icon: cactusProvider?.info.icon ?? cactusIcon,
        },
      })(config),
    }),
  });

  const mpcVaultExtWallet: WalletList[number]["wallets"][number] = () => ({
    ...mpcVaultWallet,
    id: "mpcvaultPlugin",
    name: mpcVaultProvider?.info.name ?? "MPCVault",
    rdns: mpcVaultProvider?.info.rdns ?? "com.mpcvault.console",
    installed: !!mpcVaultProvider?.provider,
    createConnector: (rkDetails) => (config) => ({
      ...rkDetails,
      ...injected({
        target: {
          id: "mpcvaultPlugin",
          name: "MPC Vault",
          provider: mpcVaultProvider?.provider as typeof window.ethereum,
          icon: mpcVaultProvider?.info.icon ?? mpcVaultIcon,
        },
      })(config),
    }),
  });

  // const copperConnectExtWallet: WalletList[number]["wallets"][number] = () => ({
  //   ...copperConnectWallet,
  //   id: "copperConnect",
  //   name: copperConnectProvider?.info.name ?? "Copper Connect",
  //   rdns: copperConnectProvider?.info.rdns ?? "co.copper",
  //   installed: !!copperConnectProvider?.provider,
  //   createConnector: (rkDetails) => (config) => ({
  //     ...rkDetails,
  //     ...injected({
  //       target: {
  //         id: "copperConnect",
  //         name: "Copper Connect",
  //         provider: copperConnectProvider?.provider as typeof window.ethereum,
  //         icon: copperConnectProvider?.info.icon ?? copperIcon,
  //       },
  //     })(config),
  //   }),
  // });

  const fireblocksExtWallet: WalletList[number]["wallets"][number] = () => ({
    ...fireblocksWallet,
    id: "fireblocks",
    name: fireblocksProvider?.info.name ?? "Fireblocks",
    rdns: fireblocksProvider?.info.rdns ?? "com.fireblocks",
    installed: !!fireblocksProvider,
    createConnector: (rkDetails) => (config) => ({
      ...rkDetails,
      ...injected({
        target: {
          id: "fireblocks",
          name: "Fireblocks",
          provider: fireblocksProvider?.provider as typeof window.ethereum,
          icon: fireblocksProvider?.info.icon ?? fireblocksIcon,
        },
      })(config),
    }),
  });

  const fineryWCWallets: WalletList[number]["wallets"] = [
    utilaWallet,
    finoaWallet,
    bitgoWallet,
    safeWalletWC,
  ].map((w) =>
    passCorrectChainsToWallet(
      (props) => ({
        ...walletConnectWallet(props),
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
      // copperConnectExtWallet,
      mpcVaultExtWallet,
      cactusLinkWallet,
      ledgerWallet,
    ].map((w) => passCorrectChainsToWallet(w, evmChains)),
    ...fineryWCWallets,
  ];

  const otherWallets: WalletList[number]["wallets"] = [
    metaMaskWallet,
    walletConnectWallet,
    coinbaseWallet,
    injectedWallet,
  ].map((w) => passCorrectChainsToWallet(w, evmChains));

  return {
    primaryWallets,
    otherWallets,
  };
};
