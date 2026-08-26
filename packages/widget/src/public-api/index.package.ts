import type { ReactElement } from "react";
import type { HelpModalProps, SKAppProps } from "./react-types";
import type { SKTheme } from "./types";

export type { SKAppProps } from "./react-types";
export type {
  ActionMeta,
  BittensorTx,
  SKBorrowExternalProviders,
  SKBorrowTxMeta,
  SKBorrowWallet,
  SKTheme,
  SKTx,
  SKTxMeta,
  SKWallet,
  SKWalletPolicy,
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
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
