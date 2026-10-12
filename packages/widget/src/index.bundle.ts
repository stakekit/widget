/**
 * Standalone bundle entry and its published declaration. Every value carries
 * its public type explicitly so `scripts/declarations/emit-entry-declarations.ts`
 * can emit this file alone, without implementation types.
 */
import { renderSKWidget as renderSKWidgetImplementation } from "./App";
import type { BundledSKWidgetProps, SKTheme } from "./public-api/types.js";
import {
  darkTheme as darkThemeTokens,
  lightTheme as lightThemeTokens,
} from "./shared/styles/theme/themes";

export type {
  ActionMeta,
  BittensorTx,
  BundledSKWidgetProps,
  EvmTx,
  SKActionArguments,
  SKActionType,
  SKBorrowExternalProviders,
  SKBorrowSignatureResult,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKBorrowTxResult,
  SKBorrowWallet,
  SKCustomTranslations,
  SKEip712TypedData,
  SKExternalProviders,
  SKHostVariant,
  SKLanguage,
  SKNetwork,
  SKPreferredTokenYieldsPerNetwork,
  SKSignMessageResult,
  SKTheme,
  SKToken,
  SKTrackEvent,
  SKTrackingConfig,
  SKTrackPage,
  SKTransactionResult,
  SKTransactionType,
  SKTranslationTree,
  SKTx,
  SKTxMeta,
  SKWallet,
  SKWalletPolicy,
  SolanaTx,
  SupportedSKChainIds,
  TonTx,
  TronTx,
} from "./public-api/types.js";
export {
  DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
} from "./public-api/types.js";

export const renderSKWidget: (
  props: BundledSKWidgetProps & { container: Element | DocumentFragment }
) => {
  rerender: (newProps: BundledSKWidgetProps) => void;
  unmount: () => void;
} = renderSKWidgetImplementation;
export const darkTheme: SKTheme = darkThemeTokens;
export const lightTheme: SKTheme = lightThemeTokens;
