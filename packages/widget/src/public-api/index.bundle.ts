import type { BundledSKWidgetProps, SKTheme } from "./types";

export type {
  ActionMeta,
  BittensorTx,
  BundledSKWidgetProps,
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

export declare const renderSKWidget: (
  props: BundledSKWidgetProps & { container: Element | DocumentFragment }
) => {
  rerender: (newProps: BundledSKWidgetProps) => void;
  unmount: () => void;
};
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
