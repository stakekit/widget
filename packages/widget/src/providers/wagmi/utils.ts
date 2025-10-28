import type { Wallet, WalletList } from "@stakekit/rainbowkit";
import { walletConnectWallet } from "@stakekit/rainbowkit/wallets";
import type { CreateConnectorFn } from "wagmi";

export const createWallet =
  (
    params: Pick<
      Wallet,
      | "id"
      | "name"
      | "iconUrl"
      | "iconBackground"
      | "downloadUrls"
      | "chainGroup"
    > &
      (
        | { isWalletConnect: true; projectId: string }
        | {
            createConnector: CreateConnectorFn;
            isWalletConnect?: never;
            projectId?: never;
          }
      )
  ): WalletList[number]["wallets"][number] =>
  () => {
    const def = {
      id: params.id,
      name: params.name,
      iconUrl: params.iconUrl,
      iconBackground: params.iconBackground,
      downloadUrls: params.downloadUrls,
      chainGroup: params.chainGroup,
    };

    if (params.isWalletConnect) {
      const wc = walletConnectWallet({ projectId: params.projectId });

      return {
        ...wc,
        ...def,
        qrCode: { getUri: (uri) => uri },
        createConnector: wc.createConnector,
      };
    }

    return {
      ...def,
      createConnector: (walletDetails) => (config) => {
        const connector = params.createConnector(config);

        return {
          ...walletDetails,
          ...connector,
        };
      },
    };
  };
