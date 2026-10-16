/**
 * React package entry and its published declaration. Every value carries its
 * public type explicitly so `scripts/declarations/emit-entry-declarations.ts`
 * can emit this file alone, without implementation types.
 */
import type { ReactElement } from "react";
import { SKApp as SKAppImplementation } from "./App";
import { HelpModal as HelpModalImplementation } from "./features/preferences/views";
import type { HelpModalProps, SKAppProps } from "./public-api/react-types.js";
import type { SKTheme } from "./public-api/types.js";
import {
  darkTheme as darkThemeTokens,
  lightTheme as lightThemeTokens,
} from "./shared/styles/theme/themes";

export type { HelpModalProps, SKAppProps } from "./public-api/react-types.js";
export type {
  ActionMeta,
  BittensorTx,
  EvmTx,
  SKActionArguments,
  SKActionType,
  SKBorrowExternalProviders,
  SKBorrowMarketsScope,
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
  SKZamaPermitMeta,
  SKZamaPermitResult,
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

export const SKApp: (props: SKAppProps) => ReactElement = SKAppImplementation;
export const HelpModal: (props: HelpModalProps) => ReactElement =
  HelpModalImplementation;
export const darkTheme: SKTheme = darkThemeTokens;
export const lightTheme: SKTheme = lightThemeTokens;
