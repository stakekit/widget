/**
 * React package entry and its published declaration. Every value carries its
 * public type explicitly so `scripts/declarations/emit-entry-declarations.ts`
 * can emit this file alone, without implementation types.
 */
import type { ReactElement } from "react";
import { SKApp as SKAppImplementation } from "./App";
import { HelpModal as HelpModalImplementation } from "./app/composition/help-modal";
import type { HelpModalProps, SKAppProps } from "./public-api/react-types.js";
import type { SKTheme } from "./public-api/types.js";
import { legacyThemeDefaults } from "./services/config/legacy-theme-defaults";

export type { HelpModalProps, SKAppProps } from "./public-api/react-types.js";
export type {
  ActionMeta,
  BittensorTx,
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

export const SKApp: (props: SKAppProps) => ReactElement = SKAppImplementation;
export const HelpModal: (props: HelpModalProps) => ReactElement =
  HelpModalImplementation;
/**
 * The legacy dark theme tokens.
 *
 * @deprecated Use `appearance: { colorScheme: "dark" }`. Passed unchanged as
 * `theme`, it gives the dark default. Removed in the next major version.
 */
export const darkTheme: SKTheme = legacyThemeDefaults.dark;
/**
 * The legacy light theme tokens.
 *
 * @deprecated Use `appearance`. Passed unchanged as `theme`, it gives the
 * light default. Removed in the next major version.
 */
export const lightTheme: SKTheme = legacyThemeDefaults.light;
