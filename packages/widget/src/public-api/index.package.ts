import type { ReactElement } from "react";
import type { HelpModalProps, SKAppProps } from "./react-types.js";
import type { SKTheme } from "./types.js";

export type { SKAppProps } from "./react-types.js";
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
} from "./types.js";
export {
  DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
} from "./types.js";

export declare const SKApp: (props: SKAppProps) => ReactElement;
export declare const HelpModal: (props: HelpModalProps) => ReactElement;
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
