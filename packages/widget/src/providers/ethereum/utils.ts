import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { createConnector } from "wagmi";

export const passCorrectChainsToWallet =
  (
    wallet: WalletList[number]["wallets"][number],
    chains: Chain[]
  ): WalletList[number]["wallets"][number] =>
  (props) => {
    const w = wallet(props);

    return {
      ...w,
      createConnector: (walletDetails) =>
        createConnector((config) =>
          w.createConnector(walletDetails)({
            ...config,
            chains: chains as [Chain, ...Chain[]],
          })
        ),
    };
  };
