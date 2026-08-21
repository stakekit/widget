import type { ChainGroup, Wallet, WalletList } from "@stakekit/rainbowkit";
import type { ReactElement } from "react";
import type { CreateConnectorFn } from "wagmi";
import type { HelpModalProps, SKAppProps, SKTheme } from "./types";

export type {
  ActionMeta,
  BittensorTx,
  SKAppProps,
  SKBorrowExternalProviders,
  SKBorrowTxMeta,
  SKBorrowWallet,
  SKTheme,
  SKTx,
  SKTxMeta,
  SKWallet,
  SupportedSKChainIds,
  TronTx,
} from "./types";
export {
  DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
} from "./types";

export declare const SKApp: (props: SKAppProps) => ReactElement;
export declare const HelpModal: (props: HelpModalProps) => ReactElement;
export declare const evmChainGroup: ChainGroup;
export declare const createWallet: (
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
) => WalletList[number]["wallets"][number];
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
