import type { Wallet, WalletList } from "@stakekit/rainbowkit";
import { walletConnectWallet } from "@stakekit/rainbowkit/wallets";
import type { CreateConnectorFn } from "wagmi";
import { evmChainGroup } from "../../index.package";

/**
 *
 * @description Only for EVM wallets
 */
export const createWallet =
  (
    params: Pick<
      Wallet,
      | "id"
      | "name"
      | "iconUrl"
      | "iconBackground"
      | "downloadUrls"
      | "mobile"
      | "qrCode"
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
      chainGroup: evmChainGroup,
      mobile: params.mobile,
      qrCode: params.qrCode,
    };

    if (params.isWalletConnect) {
      return {
        ...walletConnectWallet({ projectId: params.projectId }),
        ...def,
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
