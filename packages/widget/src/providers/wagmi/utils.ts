import type { Wallet, WalletList } from "@stakekit/rainbowkit";
import type { CreateConnectorFn } from "wagmi";

export const createWallet =
  (
    params: Pick<
      Wallet,
      "id" | "name" | "iconUrl" | "iconBackground" | "downloadUrls"
    > & {
      createConnector: CreateConnectorFn;
    }
  ): WalletList[number]["wallets"][number] =>
  () => ({
    id: params.id,
    name: params.name,
    iconUrl: params.iconUrl,
    iconBackground: params.iconBackground,
    downloadUrls: params.downloadUrls,
    createConnector: (walletDetails) => (config) => {
      const connector = params.createConnector(config);

      return {
        ...walletDetails,
        ...connector,
      };
    },
  });
