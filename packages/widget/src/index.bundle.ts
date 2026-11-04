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
  SKAppearance,
  SKBorrowExternalProviders,
  SKBorrowMarketsScope,
  SKBorrowSignatureResult,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKBorrowTxResult,
  SKBorrowWallet,
  SKColorRole,
  SKCustomTranslations,
  SKEip712TypedData,
  SKExternalProviders,
  SKHostVariant,
  SKLanguage,
  SKLayout,
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
  SKYieldProviderOrder,
  SKZamaPermitMeta,
  SKZamaPermitResult,
  SolanaTx,
  SupportedSKChainIds,
  TonTx,
  TronTx,
} from "./public-api/types.js";
export {
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
  YieldCategory,
  YieldProviderId,
} from "./public-api/types.js";

export const renderSKWidget: (
  props: BundledSKWidgetProps & { container: Element | DocumentFragment }
) => {
  rerender: (newProps: BundledSKWidgetProps) => void;
  unmount: () => void;
} = renderSKWidgetImplementation;
/**
 * The legacy dark theme tokens.
 *
 * @deprecated Use `appearance: { colorScheme: "dark" }`. Passed unchanged as
 * `theme`, it gives the dark default. Removed in the next major version.
 */
export const darkTheme: SKTheme = darkThemeTokens;
/**
 * The legacy light theme tokens.
 *
 * @deprecated Use `appearance`. Passed unchanged as `theme`, it gives the
 * light default. Removed in the next major version.
 */
export const lightTheme: SKTheme = lightThemeTokens;
