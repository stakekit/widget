import {
  type DashboardYieldCategory,
  DashboardYieldCategory as DomainDashboardYieldCategory,
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
  DomainDashboardYieldCategory as DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
};

type Hex = `0x${string}`;

type DecodedEVMTransaction = {
  to: Hex;
  from: Hex;
  data: Hex;
  value: Hex | undefined;
  nonce: Hex;
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

type EVMTx = { type: "evm"; tx: DecodedEVMTransaction };
type SolanaTx = { type: "solana"; tx: DecodedSolanaTransaction };
type TonTx = { type: "ton"; tx: DecodedTonTransaction };

export type TronTx = { type: "tron"; tx: DecodedTronTransaction };
export type BittensorTx = {
  type: "bittensor";
  tx: DecodedSubstrateTransaction;
};

export type SKTx = EVMTx | SolanaTx | TonTx | TronTx | BittensorTx;

export type SKNetwork = Network;

type SKToken = {
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

type ActionArguments = {
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

type ClassicActionType =
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
  | "DELEGATE";

type ClassicTransactionType =
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
  | "BATCH";

export type ActionMeta = {
  actionId: string;
  actionType: ClassicActionType;
  address?: string;
  amount: string | null;
  amountRaw?: string | null;
  rawArguments?: ActionArguments | null;
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
  txType: ClassicTransactionType;
  structuredTransaction?: NonNullishValue | null;
  annotatedTransaction?: NonNullishValue | null;
  gasEstimate?: string;
};

type SKTransactionResult =
  | string
  | { type: "success"; txHash: string }
  | { type: "error"; error: string };

export type SKWallet = {
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(tx: SKTx, txMeta: SKTxMeta): Promise<SKTransactionResult>;
};

export type SKBorrowTxMeta = {
  readonly actionId: string;
  readonly actionType:
    | "supply"
    | "borrow"
    | "repay"
    | "withdraw"
    | "enableCollateral"
    | "disableCollateral";
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
    | "DISABLE_COLLATERAL";
};

export type SKBorrowWallet = SKWallet & {
  sendBorrowTransaction(
    tx: SKTx,
    txMeta: SKBorrowTxMeta
  ): Promise<SKTransactionResult>;
};

export type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: `${string}-${string}`;
  readonly supportsBorrow?: false;
  supportedChainIds?: SupportedSKChainIds[];
  type: "generic";
  provider: SKWallet;
};

export type SKBorrowExternalProviders = Omit<
  SKExternalProviders,
  "provider" | "supportsBorrow"
> & {
  readonly supportsBorrow: true;
  readonly provider: SKBorrowWallet;
};

export type HostVariant = "zerion" | "utila" | "default" | "finery" | "porto";

type TranslationTree = Readonly<{
  [key: string]: string | TranslationTree;
}>;

type Languages = "en" | "fr";

type TrackPage =
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

type TrackEvent =
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

export type TrackingConfig = {
  trackEvent?: (
    event: TrackEvent,
    properties?: Record<string, unknown>
  ) => void;
  trackPageView?: (
    page: TrackPage,
    properties?: Record<string, unknown>
  ) => void;
};

export type PreferredTokenYieldsPerNetwork = Readonly<
  Record<string, Readonly<Record<`${string}-${string}`, string>>>
>;

type SettingsPropsBase = {
  apiKey: string;
  baseUrl?: string;
  borrowApiUrl?: string;
  yieldsApiUrl?: string;
  theme?: SKTheme;
  tracking?: TrackingConfig;
  onMountAnimationComplete?: () => void;
  forceWalletConnectOnly?: boolean;
  hideNetworkLogo?: boolean;
  disableInitLayoutAnimation?: boolean;
  disableResizingInputFontSize?: boolean;
  disableAutoScrollToTop?: boolean;
  language?: Languages;
  isSafe?: boolean;
  disableInjectedProviderDiscovery?: boolean;
  mapWalletFn?: (props: {
    id: string;
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  }) => {
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  };
  walletPolicy?: SKWalletPolicy;
  customTranslations?: Partial<
    Record<Languages, { translation: TranslationTree }>
  >;
  /**
   * @deprecated Earn now always derives project-enabled, enterable options from
   * the canonical Earn Catalog. This setting has no effect.
   */
  tokensForEnabledYieldsOnly?: boolean;
  validatorsConfig?: Record<
    string,
    {
      allowed?: string[];
      blocked?: string[];
      preferred?: string[];
      mergePreferredWithDefault?: boolean;
      preferredOnly?: boolean;
    }
  >;
  tokenIconMapping?: Record<string, string> | ((token: SKToken) => string);
  chainIconMapping?: Record<string, string> | ((chain: string) => string);
  /** Enables the dashboard route tree and category yield grouping by default. */
  dashboardVariant?: boolean;
  dashboardYieldCategoryOrder?: DashboardYieldCategory[];
  yieldGrouping?: "flat" | "category";
  institutionalWallets?: boolean;
  hideChainSelector?: boolean;
  hideAccountAndChainSelector?: boolean;
  preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  portalContainer?: HTMLElement;
  tonConnectManifestUrl?: string;
  initialChain?: SupportedSKChainIds;
};

type BorrowProviderSettings =
  | {
      borrowEnabled?: false;
      externalProviders?: SKExternalProviders | SKBorrowExternalProviders;
    }
  | {
      borrowEnabled?: boolean;
      externalProviders?: SKBorrowExternalProviders;
    };

export type SettingsProps = SettingsPropsBase & BorrowProviderSettings;

type SKBundleVariantProps = {
  readonly variant: Exclude<HostVariant, "zerion">;
};

export type BundledSKWidgetProps = SettingsProps &
  (SKBundleVariantProps | { readonly variant?: never });
