import type { SKAppProps, SKTheme } from "./types";

export type {
  ActionMeta,
  BittensorTx,
  BundledSKWidgetProps,
  SKBorrowExternalProviders,
  SKBorrowTxMeta,
  SKBorrowWallet,
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

export declare const renderSKWidget: (
  props: SKAppProps & { container: Element | DocumentFragment }
) => {
  rerender: (newProps: SKAppProps) => void;
  unmount: () => void;
};
export declare const darkTheme: SKTheme;
export declare const lightTheme: SKTheme;
