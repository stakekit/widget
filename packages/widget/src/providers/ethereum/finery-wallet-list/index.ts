import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  safeWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import { Maybe } from "purify-ts";
import { passCorrectChainsToWallet } from "../utils";
import bitGoIcon from "./custom-wallet-icons/bitgo.svg";
import cactusIcon from "./custom-wallet-icons/cactus.svg";
import finoaIcon from "./custom-wallet-icons/finoa.svg";
import fireblocksIcon from "./custom-wallet-icons/fireblocks.svg";
import gk8 from "./custom-wallet-icons/gk8.svg";
import mpcVaultIcon from "./custom-wallet-icons/mpc-vault.jpg";
import qredoIcon from "./custom-wallet-icons/qredo.png";
import utilIcon from "./custom-wallet-icons/utila.svg";
import zodioIcon from "./custom-wallet-icons/zodia.svg";

type CommonWalletOptions = Pick<
  ReturnType<WalletList[number]["wallets"][number]>,
  "iconUrl" | "id" | "name" | "rdns" | "iconBackground"
>;

const bitgoWallet: CommonWalletOptions = {
  iconUrl: bitGoIcon,
  id: "bitgo",
  name: "BitGo",
  rdns: "com.bitgo.wallet",
  iconBackground: "#010E1B",
};

const fireblocksWallet: CommonWalletOptions = {
  iconUrl: fireblocksIcon,
  id: "fireblocks",
  name: "Fireblocks",
  rdns: "com.fireblocks.wallet",
  iconBackground: "#131A2D",
};

const cactusWallet: CommonWalletOptions = {
  iconUrl: cactusIcon,
  id: "cactus",
  name: "Cactus",
  rdns: "com.cactus.wallet",
  iconBackground: "#FFF",
};

const zodiaWallet: CommonWalletOptions = {
  iconUrl: zodioIcon,
  id: "zodia",
  name: "Zodia",
  rdns: "com.zodia.wallet",
  iconBackground: "#FFF",
};

const mpcVaultWallet: CommonWalletOptions = {
  iconUrl: mpcVaultIcon,
  id: "mpc-vault",
  name: "MPC Vault",
  rdns: "com.mpcvault.wallet",
  iconBackground: "#1A1A1A",
};

const gk8Wallet: CommonWalletOptions = {
  iconUrl: gk8,
  id: "gk8",
  name: "GK8",
  rdns: "com.gk8.wallet",
  iconBackground: "#141415",
};

const qredoWallet: CommonWalletOptions = {
  iconUrl: qredoIcon,
  id: "qredo",
  name: "Qredo",
  rdns: "com.qredo.wallet",
  iconBackground: "#141415",
};

const utilaWallet: CommonWalletOptions = {
  iconUrl: utilIcon,
  id: "utila",
  name: "Utila",
  rdns: "com.utila.wallet",
  iconBackground: "#FFF",
};

const finoaWallet: CommonWalletOptions = {
  iconUrl: finoaIcon,
  id: "finoa",
  name: "Finoa",
  rdns: "com.finoa.wallet",
  iconBackground: "#FFF",
};

const safeWalletWC: CommonWalletOptions = Maybe.of(safeWallet())
  .map((val) => ({
    iconUrl: val.iconUrl,
    id: val.id,
    name: val.name,
    rdns: val.rdns,
    iconBackground: val.iconBackground,
  }))
  .unsafeCoerce();

export const createFineryWallets: (evmChains: Chain[]) => {
  fineryMMIWallets: WalletList[number]["wallets"];
  fineryWCWallets: WalletList[number]["wallets"];
  fineryOtherWallets: WalletList[number]["wallets"];
} = (evmChains: Chain[]) => {
  const fineryMMIWallets: WalletList[number]["wallets"] = [
    bitgoWallet,
    fireblocksWallet,
    cactusWallet,
    zodiaWallet,
    mpcVaultWallet,
    gk8Wallet,
    qredoWallet,
  ].map((w) =>
    passCorrectChainsToWallet(
      (props) => ({
        ...metaMaskWallet(props),
        ...w,
        id: `${w.id}-mmi`,
        rdns: `${w.rdns}-mmi`,
      }),
      evmChains
    )
  );

  const fineryWCWallets: WalletList[number]["wallets"] = [
    walletConnectWallet,
    ...[
      bitgoWallet,
      fireblocksWallet,
      cactusWallet,
      zodiaWallet,
      mpcVaultWallet,
      gk8Wallet,
      utilaWallet,
      finoaWallet,
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
    ),
  ];

  const fineryOtherWallets: WalletList[number]["wallets"] = [
    coinbaseWallet,
    metaMaskWallet,
    safeWallet,
  ].map((w) => passCorrectChainsToWallet(w, evmChains));

  return {
    fineryMMIWallets,
    fineryWCWallets,
    fineryOtherWallets,
  };
};
