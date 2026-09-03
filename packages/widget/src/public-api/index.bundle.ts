import type { BundledSKWidgetProps, SKTheme } from "./types.js";

export type {
  ActionMeta,
  BittensorTx,
  BundledSKWidgetProps,
  SKBorrowExternalProviders,
  SKBorrowTx,
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

export declare const renderSKWidget: (
  props: BundledSKWidgetProps & { container: Element | DocumentFragment }
) => {
  rerender: (newProps: BundledSKWidgetProps) => void;
  unmount: () => void;
};
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
