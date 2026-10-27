import {
  YieldCategory as DomainYieldCategory,
  YieldProviderId as DomainYieldProviderId,
  type YieldCategory,
  type YieldProviderId,
} from "../domain/earn/contract.js";
import type { Network } from "../domain/network/contract.js";
import {
  EvmChainIds,
  MiscChainIds,
  type WalletPolicy as SKWalletPolicy,
  SubstrateChainIds,
  type SupportedSKChainIds,
} from "../domain/wallet/contract.js";
import type { SKTheme } from "./theme.js";

export type {
  SupportedSKChainIds,
  WalletPolicy as SKWalletPolicy,
} from "../domain/wallet/contract.js";
export type { SKTheme } from "./theme.js";
export {
  DomainYieldCategory as YieldCategory,
  DomainYieldProviderId as YieldProviderId,
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
};

type Hex = `0x${string}`;

export type SKEip712TypedData = {
  readonly domain: {
    readonly chainId?: number;
    readonly name?: string;
    readonly salt?: Hex;
    readonly verifyingContract?: Hex;
    readonly version?: string;
  };
  readonly message: Readonly<Record<string, unknown>>;
  readonly primaryType: string;
  readonly types: Readonly<
    Record<
      string,
      ReadonlyArray<{ readonly name: string; readonly type: string }>
    >
  >;
};

/** EVM transaction. The host wallet selects the nonce. */
type DecodedEVMTransaction = {
  to: Hex;
  from: Hex;
  data: Hex;
  value: Hex | undefined;
  gas: Hex;
  chainId: Hex;
} & (
  | {
      type: "0x2";
      maxFeePerGas: Hex;
      maxPriorityFeePerGas: Hex | undefined;
    }
  | {
      type: "0x1";
      gasPrice: Hex | undefined;
    }
);

/** Borrow EVM transaction. `type` follows the API; fee fields are `undefined` unless the API quotes them. The host wallet selects the nonce. */
type DecodedBorrowEVMTransaction = {
  to: Hex;
  from: Hex;
  data: Hex;
  value: Hex | undefined;
  gas: Hex;
  chainId: Hex;
} & (
  | {
      type: "0x0";
      gasPrice: Hex | undefined;
    }
  | {
      type: "0x2";
      maxFeePerGas: Hex | undefined;
      maxPriorityFeePerGas: Hex | undefined;
    }
);

type DecodedSolanaTransaction = string;

type DecodedTonTransaction =
  | { readonly seqno: bigint; readonly message: string }
  | ReadonlyArray<{
      readonly address: string;
      readonly amount: string;
      readonly payload: string;
    }>;

type DecodedTronTransaction = {
  readonly raw_data: {
    readonly contract: ReadonlyArray<Readonly<Record<string, unknown>>>;
    readonly ref_block_bytes: string;
    readonly ref_block_hash: string;
    readonly expiration: number;
    readonly timestamp: number;
    readonly data?: unknown;
    readonly fee_limit?: unknown;
  };
  readonly raw_data_hex: string;
  readonly txID: string;
  readonly visible: boolean;
};

type DecodedSubstrateTransaction = {
  readonly tx: {
    readonly address: string;
    readonly assetId?: Hex;
    readonly blockHash: Hex;
    readonly blockNumber: Hex;
    readonly era: Hex;
    readonly genesisHash: Hex;
    readonly metadataHash?: Hex;
    readonly method: string;
    readonly mode?: number;
    readonly nonce: Hex;
    readonly specVersion: Hex;
    readonly tip: Hex;
    readonly transactionVersion: Hex;
    readonly signedExtensions: ReadonlyArray<string>;
    readonly version: number;
    readonly metadataRpc: Hex;
  };
  readonly specName: string;
  readonly specVersion: number;
  readonly metadataRpc: Hex;
};

export type EvmTx = { type: "evm"; tx: DecodedEVMTransaction };
export type SolanaTx = { type: "solana"; tx: DecodedSolanaTransaction };
export type TonTx = { type: "ton"; tx: DecodedTonTransaction };

export type TronTx = { type: "tron"; tx: DecodedTronTransaction };
export type BittensorTx = {
  type: "bittensor";
  tx: DecodedSubstrateTransaction;
};

export type SKTx = EvmTx | SolanaTx | TonTx | TronTx | BittensorTx;

export type SKBorrowTx = { type: "evm"; tx: DecodedBorrowEVMTransaction };

export type SKNetwork = Network;

export type SKToken = {
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly network: SKNetwork;
  readonly address?: string;
  readonly logoURI?: string;
  readonly isPoints?: boolean;
  readonly coinGeckoId?: string;
  readonly feeConfigurationId?: string;
};

export type SKActionArguments = {
  readonly amount?: string;
  readonly amountRaw?: string;
  readonly amounts?: ReadonlyArray<string>;
  readonly shareAmount?: string;
  readonly shareAmountRaw?: string;
  readonly validatorAddress?: string;
  readonly validatorAddresses?: ReadonlyArray<string>;
  readonly providerId?: string;
  readonly duration?: number;
  readonly inputToken?: string;
  readonly inputTokenNetwork?: SKNetwork;
  readonly outputToken?: string;
  readonly outputTokenNetwork?: SKNetwork;
  readonly subnetId?: number;
  readonly tronResource?: "BANDWIDTH" | "ENERGY";
  readonly feeConfigurationId?: string;
  readonly cosmosPubKey?: string;
  readonly tezosPubKey?: string;
  readonly cAddressBech?: string;
  readonly pAddressBech?: string;
  readonly executionMode?: "individual" | "batched";
  readonly ledgerWalletApiCompatible?: boolean;
  readonly useMaxAmount?: boolean;
  readonly useInstantExecution?: boolean;
  readonly useAutoClaim?: boolean;
  readonly skipPrechecks?: boolean;
  readonly useMaxAllowance?: boolean;
  readonly feePayerAddress?: string;
  readonly receiverAddress?: string;
  readonly rangeMin?: string;
  readonly rangeMax?: string;
  readonly percentage?: number;
  readonly tokenId?: string;
};

export type SKActionType =
  | "STAKE"
  | "UNSTAKE"
  | "WITHDRAW_REQUEST"
  | "INSTANT_WITHDRAW"
  | "CLAIM_REWARDS"
  | "AUTO_SWEEP_UNSTAKE_REWARDS"
  | "AUTO_SWEEP_WITHDRAW_REWARDS"
  | "RESTAKE_REWARDS"
  | "WITHDRAW"
  | "WITHDRAW_ALL"
  | "RESTAKE"
  | "CLAIM_UNSTAKED"
  | "UNLOCK_LOCKED"
  | "STAKE_LOCKED"
  | "VOTE"
  | "REVOKE"
  | "VOTE_LOCKED"
  | "REVOTE"
  | "REBOND"
  | "MIGRATE"
  | "VERIFY_WITHDRAW_CREDENTIALS"
  | "DELEGATE"
  | "MERGE"
  | "CANCEL_PENDING";

export type SKTransactionType =
  | "SWAP"
  | "DEPOSIT"
  | "APPROVAL"
  | "STAKE"
  | "SET_OPERATOR"
  | "CLAIM_UNSTAKED"
  | "CLAIM_REWARDS"
  | "RESTAKE_REWARDS"
  | "UNSTAKE"
  | "SPLIT"
  | "MERGE"
  | "LOCK"
  | "UNLOCK"
  | "SUPPLY"
  | "ADD_LIQUIDITY"
  | "REMOVE_LIQUIDITY"
  | "BRIDGE"
  | "VOTE"
  | "REVOKE"
  | "RESTAKE"
  | "REBOND"
  | "WITHDRAW"
  | "WITHDRAW_ALL"
  | "CREATE_ACCOUNT"
  | "REVEAL"
  | "MIGRATE"
  | "DELEGATE"
  | "UNDELEGATE"
  | "UTXO_P_TO_C_IMPORT"
  | "UTXO_C_TO_P_IMPORT"
  | "WRAP"
  | "UNWRAP"
  | "UNFREEZE_LEGACY"
  | "UNFREEZE_LEGACY_BANDWIDTH"
  | "UNFREEZE_LEGACY_ENERGY"
  | "UNFREEZE_BANDWIDTH"
  | "UNFREEZE_ENERGY"
  | "FREEZE_BANDWIDTH"
  | "FREEZE_ENERGY"
  | "UNDELEGATE_BANDWIDTH"
  | "UNDELEGATE_ENERGY"
  | "P2P_NODE_REQUEST"
  | "CREATE_EIGENPOD"
  | "VERIFY_WITHDRAW_CREDENTIALS"
  | "START_CHECKPOINT"
  | "VERIFY_CHECKPOINT_PROOFS"
  | "QUEUE_WITHDRAWALS"
  | "COMPLETE_QUEUED_WITHDRAWALS"
  | "LZ_DEPOSIT"
  | "LZ_WITHDRAW"
  | "LUGANODES_PROVISION"
  | "LUGANODES_EXIT_REQUEST"
  | "INFSTONES_PROVISION"
  | "INFSTONES_EXIT_REQUEST"
  | "INFSTONES_CLAIM_REQUEST"
  | "BATCH"
  | "REDEEM"
  | "CANCEL_PENDING";

export type ActionMeta = {
  actionId: string;
  actionType: SKActionType;
  address?: string;
  amount: string | null;
  amountRaw?: string | null;
  rawArguments?: SKActionArguments | null;
  yieldId?: string;
  inputToken: SKToken | undefined;
  providersDetails: Array<{
    name: string;
    address: string | undefined;
    rewardRate: number | undefined;
    rewardType: string | undefined;
    website: string | undefined;
    logo: string | undefined;
  }>;
};

type NonNullishValue = NonNullable<unknown>;

export type SKTxMeta = ActionMeta & {
  txId: string;
  txType: SKTransactionType;
  structuredTransaction?: NonNullishValue | null;
  annotatedTransaction?: NonNullishValue | null;
  gasEstimate?: string;
};

/**
 * Outcome of `SKWallet.sendTransaction`. A bare string is the broadcast hash.
 * - `cancelled`: the user declined in the wallet. Nothing was broadcast.
 * - `error`: the request failed. Include `txHash` whenever the transaction
 *   was broadcast before the failure (for example a receipt timeout): the
 *   Widget then tracks that transaction instead of asking to sign it again.
 */
export type SKTransactionResult =
  | string
  | { type: "success"; txHash: string }
  | { type: "cancelled" }
  | { type: "error"; error: string; txHash?: string };

/**
 * Outcome of `SKWallet.signMessage`. A bare string is the signature.
 * `cancelled` means the user declined in the wallet.
 */
export type SKSignMessageResult =
  | string
  | { type: "success"; signature: string }
  | { type: "cancelled" }
  | { type: "error"; error: string };

/** Host wallet adapter the widget calls for signatures, chain switches and transactions. */
export type SKWallet = {
  /** Signs a message payload from an action step that is a message, not a transaction. */
  signMessage: (message: string) => Promise<SKSignMessageResult>;
  /**
   * Switches the host wallet to `chainId`. Resolve once the switch succeeded;
   * the widget then uses that chain. Keep `currentChain` in sync afterwards.
   */
  switchChain: (chainId: number) => Promise<void>;
  /** Signs and broadcasts a staking transaction. Resolve once it is broadcast. */
  sendTransaction(tx: SKTx, txMeta: SKTxMeta): Promise<SKTransactionResult>;
  /**
   * Signs the EIP-712 permit that reveals Zama confidential balances. Without
   * it, Zama deposits are blocked: balances could not be revealed to withdraw.
   */
  readonly signZamaPermit?: (
    typedData: SKEip712TypedData,
    meta: SKZamaPermitMeta
  ) => Promise<SKZamaPermitResult>;
};

export type SKBorrowTxMeta = {
  readonly actionId: string;
  readonly actionType:
    | "supply"
    | "borrow"
    | "repay"
    | "withdraw"
    | "enableCollateral"
    | "disableCollateral"
    | "supplyAndBorrow";
  readonly address: string;
  readonly integrationId: string;
  readonly rawArguments: {
    readonly amount?: string;
    readonly amountRaw?: string;
    readonly borrowAmount?: string;
    readonly collateralAmount?: string;
    readonly collateralAmountRaw?: string;
    readonly collateralTokenAddress?: string;
    readonly marketId: string;
    readonly repayAll?: boolean;
    readonly targetLtv?: string;
    readonly tokenAddress?: string;
  };
  readonly txId: string;
  readonly txType:
    | "APPROVAL"
    | "AUTHORIZE"
    | "DEAUTHORIZE"
    | "SUPPLY"
    | "BORROW"
    | "REPAY"
    | "WITHDRAW"
    | "ENABLE_COLLATERAL"
    | "DISABLE_COLLATERAL"
    | "BUNDLE"
    | "WRAP";
};

/**
 * Outcome of `SKBorrowWallet.sendBorrowTransaction`.
 *
 * - `success`: the transaction was broadcast. Resolve as soon as it is
 *   broadcast; do not wait for confirmation.
 * - `cancelled`: the user declined in the wallet. Nothing was broadcast.
 * - `error`: the request failed. Include `txHash` whenever the transaction
 *   was broadcast before the failure (for example a receipt timeout): the
 *   Widget then tracks that transaction instead of asking to sign it again.
 *   Without `txHash`, the Widget treats the step as not broadcast and lets the
 *   user retry it.
 */
export type SKBorrowTxResult =
  | { readonly type: "success"; readonly txHash: string }
  | { readonly type: "cancelled" }
  | {
      readonly type: "error";
      readonly error: string;
      readonly txHash?: string;
    };

/** Outcome of `SKBorrowWallet.signTypedData`. */
export type SKBorrowSignatureResult =
  | { readonly type: "success"; readonly signature: string }
  | { readonly type: "cancelled" }
  | { readonly type: "error"; readonly error: string };

/**
 * External provider wallet for Borrow. Report outcomes through the returned
 * result; a rejected Promise is treated as an `error` without `txHash`.
 */
export type SKBorrowWallet = SKWallet & {
  /** Signs a Borrow EIP-712 payload. */
  readonly signTypedData: (
    typedData: SKEip712TypedData,
    txMeta: SKBorrowTxMeta
  ) => Promise<SKBorrowSignatureResult>;
  /** Broadcasts a Borrow transaction. */
  readonly sendBorrowTransaction: (
    tx: SKBorrowTx,
    txMeta: SKBorrowTxMeta
  ) => Promise<SKBorrowTxResult>;
};

/** What a Zama decryption permit reveals, for the host's signing prompt. */
export type SKZamaPermitMeta = {
  readonly address: string;
  readonly chainId: number;
  readonly contracts: ReadonlyArray<string>;
};

/** Outcome of `SKWallet.signZamaPermit`. */
export type SKZamaPermitResult =
  | { readonly type: "success"; readonly signature: string }
  | { readonly type: "cancelled" }
  | { readonly type: "error"; readonly error: string };

/** Connects the widget to a host-owned wallet instead of its own wallet list. */
export type SKExternalProviders = {
  /** Chain the host wallet is on. Defaults to the first supported chain. */
  currentChain?: SupportedSKChainIds;
  /** Connected account address. Pass `""` while disconnected; do not remove the provider. */
  currentAddress: string;
  /**
   * Token to preselect when the page URL has no `token` parameter, as
   * `${network}-${address}` (`${network}-` for a native token). Read at mount.
   */
  initToken?: `${string}-${string}`;
  /** Chains the host wallet supports. Omit to allow every configured chain; `[]` is invalid. */
  supportedChainIds?: SupportedSKChainIds[];
  /** Provider kind. Only `"generic"` is supported. */
  type: "generic";
  /** Wallet adapter the widget calls. Its presence is fixed at mount; its callbacks may change. */
  provider: SKWallet;
};

/** External provider for hosts that set `borrowEnabled`; the wallet must support Borrow. */
export type SKBorrowExternalProviders = Readonly<
  Omit<SKExternalProviders, "provider" | "supportedChainIds">
> & {
  /** Chains the host wallet supports. Omit to allow every configured chain; `[]` is invalid. */
  readonly supportedChainIds?: ReadonlyArray<SupportedSKChainIds>;
  /** Wallet adapter the widget calls, including the Borrow callbacks. */
  readonly provider: SKBorrowWallet;
};

/** Host integration preset: presentation, theme, wallet catalogue and tracking. */
export type SKHostVariant = "zerion" | "utila" | "default" | "finery" | "porto";

export type SKTranslationTree = Readonly<{
  [key: string]: string | SKTranslationTree;
}>;

export type SKLanguage = "en" | "fr";

/**
 * Which Borrow markets the widget lists: `"enabled"` lists only markets
 * enabled for the API key's project; `"all"` lists every supported market.
 */
export type SKBorrowMarketsScope = "all" | "enabled";

/** Per-language translation overrides, deep-merged over the widget's own strings. */
export type SKCustomTranslations = Partial<
  Record<SKLanguage, { translation: SKTranslationTree }>
>;

export type SKTrackPage =
  | "Earn"
  | "Borrow"
  | "Borrow review"
  | "Borrow steps"
  | "Borrow complete"
  | "Positions"
  | "Activity"
  | "Position details"
  | "Stake review"
  | "Unstake review"
  | "Pending action review"
  | "Staking steps"
  | "Unstake steps"
  | "Activity steps"
  | "Pending action steps"
  | "Stake complete"
  | "Activity complete"
  | "Unstake complete"
  | "Pending action complete";

export type SKTrackEvent =
  | "Tab clicked"
  | "Connect wallet clicked"
  | "Add ledger account clicked"
  | "Select token modal opened"
  | "Exit receive token modal opened"
  | "Token selected"
  | "Select yield modal opened"
  | "Yield selected"
  | "Select validator modal opened"
  | "Select validator modal closed"
  | "Select validator view more clicked"
  | "Validator selected"
  | "Validator removed"
  | "Widget disconnect clicked"
  | "Back clicked"
  | "Help modal opened"
  | "Terms modal opened"
  | "Terms modal accepted"
  | "Terms modal declined"
  | "Earn page max clicked"
  | "Borrow page max clicked"
  | "Borrow market selected"
  | "Borrow collateral selected"
  | "Borrow review clicked"
  | "Connected wallet"
  | "Import validator modal opened"
  | "Chain modal opened"
  | "Account modal opened"
  | "Terms clicked"
  | "Transaction signed"
  | "Transaction submitted"
  | "Transaction not confirmed"
  | "Position details page max clicked"
  | "Unstake clicked"
  | "Pending action clicked"
  | "Validators submitted"
  | "Validator imported"
  | "View transaction clicked"
  | "Action steps cancelled"
  | "system/initYield"
  | "system/initToken";

/** Host analytics callbacks. */
export type SKTrackingConfig = {
  /** Called when a tracked widget event occurs. */
  trackEvent?: (
    event: SKTrackEvent,
    properties?: Record<string, unknown>
  ) => void;
  /** Called when a tracked widget page is shown. */
  trackPageView?: (
    page: SKTrackPage,
    properties?: Record<string, unknown>
  ) => void;
};

/**
 * Preferred yield per token, keyed by network and then by
 * `${network}-${address}` (`${network}-` for a native token; case-insensitive).
 * The value is a yield ID, or `"*"` for the widget's default choice.
 */
export type SKPreferredTokenYieldsPerNetwork = Readonly<
  Record<string, Readonly<Record<`${string}-${string}`, string>>>
>;

/**
 * Yield provider IDs to list first in each dashboard category tab, in rank
 * order. Matches a yield's provider, not the validators it stakes with.
 * Known IDs are in `YieldProviderId`; other strings are accepted so newer
 * providers work before the widget lists them.
 */
export type SKYieldProviderOrder = Partial<
  Record<YieldCategory, Array<YieldProviderId | (string & {})>>
>;

type SettingsPropsBase = {
  /** StakeKit API key. Read at mount; remount the widget to change it. */
  apiKey: string;
  /** StakeKit API base URL. Read at mount; remount the widget to change it. */
  baseUrl?: string;
  /** Borrow API URL. Read at mount; remount the widget to change it. */
  borrowApiUrl?: string;
  /** Borrow market catalog listed for new borrows. Defaults to `"all"`. */
  borrowMarketsScope?: SKBorrowMarketsScope;
  /** Yields API URL. Read at mount; remount the widget to change it. */
  yieldsApiUrl?: string;
  /** Theme tokens, deep-merged over the light theme. */
  theme?: SKTheme;
  /** Analytics callbacks. */
  tracking?: SKTrackingConfig;
  /** Called once the initial mount animation finishes. */
  onMountAnimationComplete?: () => void;
  /** Hides the network badge on token icons. */
  hideNetworkLogo?: boolean;
  /** Hides the estimated gas fee on the review screen. Commission and protocol fees stay visible. */
  hideGasFee?: boolean;
  /** Skips the initial layout and reveal animation. */
  disableInitLayoutAnimation?: boolean;
  /** Keeps the amount input font size fixed instead of shrinking it for long values. */
  disableResizingInputFontSize?: boolean;
  /** Stops the widget scrolling the window to the top on navigation. */
  disableAutoScrollToTop?: boolean;
  /** UI language. Defaults to the browser language, falling back to English. */
  language?: SKLanguage;
  /** Runs inside a Safe app and connects through the Safe wallet. Read at mount. */
  isSafe?: boolean;
  /** Ignores injected EVM wallets announced through EIP-6963. Read at mount. */
  disableInjectedProviderDiscovery?: boolean;
  /** Changes how a wallet is shown in the wallet list. Read at mount. */
  mapWalletFn?: (props: {
    /** Wallet ID, as used by `walletPolicy`. */
    id: string;
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  }) => {
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  };
  /** Filters, orders and groups the wallet list by wallet ID. Read at mount. */
  walletPolicy?: SKWalletPolicy;
  /** Translation overrides per language. */
  customTranslations?: SKCustomTranslations;
  /** Validator rules per network ID, or `"*"` for every network without its own entry. */
  validatorsConfig?: Record<
    string,
    {
      /** Shows only these validator addresses. */
      allowed?: string[];
      /** Hides these validator addresses, even when allowed. */
      blocked?: string[];
      /** Marks these validator addresses as preferred. */
      preferred?: string[];
      /** Also keeps the API's preferred validators. Defaults to `true`. */
      mergePreferredWithDefault?: boolean;
      /** Shows only preferred validators. Defaults to `false`. */
      preferredOnly?: boolean;
    }
  >;
  /** Token icon URLs by token symbol, or a function returning the URL for a token. */
  tokenIconMapping?: Record<string, string> | ((token: SKToken) => string);
  /** Network icon URLs by network ID (for example `"ethereum"`), or a function returning one. */
  chainIconMapping?: Record<string, string> | ((chain: string) => string);
  /** Enables the dashboard route tree and category yield grouping by default. */
  dashboardVariant?: boolean;
  /** Order of yield categories. Omitted categories follow in the default order. */
  yieldCategoryOrder?: YieldCategory[];
  /**
   * Lists these yield providers first within each category tab, and selects
   * the first one by default. Applies only with category yield grouping.
   */
  yieldProviderOrder?: SKYieldProviderOrder;
  /** Lists yields flat or grouped by category. Defaults to `"category"` with `dashboardVariant`, else `"flat"`. */
  yieldGrouping?: "flat" | "category";
  /** Offers institutional wallets instead of the regular wallet list. Read at mount. */
  institutionalWallets?: boolean;
  /** Hides the chain selector in the header. */
  hideChainSelector?: boolean;
  /** Hides the account and chain selector in the dashboard header. */
  hideAccountAndChainSelector?: boolean;
  /** Yield to preselect for a token. */
  preferredTokenYieldsPerNetwork?: SKPreferredTokenYieldsPerNetwork;
  /** Element that hosts the widget's dialogs, menus and tooltips. */
  portalContainer?: HTMLElement;
  /** TON Connect manifest URL. Defaults to StakeKit's manifest. Read at mount. */
  tonConnectManifestUrl?: string;
  /** Chain to request when the user connects a wallet. */
  initialChain?: SupportedSKChainIds;
};

type BorrowProviderSettings =
  | {
      /** Enables Borrow. Read at mount; remount the widget to change it. */
      borrowEnabled?: false;
      externalProviders?: SKExternalProviders | SKBorrowExternalProviders;
    }
  | {
      /**
       * Enables Borrow. Read at mount; remount the widget to change it.
       * `boolean`, not `true`: a runtime flag must still type-check.
       */
      borrowEnabled?: boolean;
      externalProviders?: SKBorrowExternalProviders;
    };

export type SettingsProps = SettingsPropsBase & BorrowProviderSettings;

type SKBundleVariantProps = {
  /** Host integration preset. Defaults to `"default"`; `"zerion"` needs the React package. */
  readonly variant: Exclude<SKHostVariant, "zerion">;
};

export type BundledSKWidgetProps = SettingsProps &
  (SKBundleVariantProps | { readonly variant?: never });
