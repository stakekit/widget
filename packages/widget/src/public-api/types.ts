import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { ReactNode, RefObject } from "react";

export enum EvmChainIds {
  Ethereum = 1,
  Polygon = 137,
  Optimism = 10,
  Arbitrum = 42_161,
  AvalancheC = 43_114,
  Celo = 42_220,
  Harmony = 1_666_600_000,
  Viction = 88,
  Binance = 56,
  Base = 8453,
  Linea = 59_144,
  Core = 1116,
  Sonic = 146,
  EthereumHoodi = 560_048,
  EthereumGoerli = 5,
  EthereumSepolia = 11_155_111,
  Unichain = 130,
  Katana = 747_474,
  Gnosis = 100,
  Hyperevm = 999,
  Plasma = 9745,
  Monad = 143,
  MonadTestnet = 10_143,
  Pharos = 1672,
}

export enum SubstrateChainIds {
  Polkadot = 9999,
  Bittensor = 558,
}

export enum MiscChainIds {
  Near = 397,
  Tezos = 1729,
  Solana = 501,
  Tron = 79,
  Ton = 3412,
  Cardano = 2000,
}

export type SupportedSKChainIds =
  | EvmChainIds
  | SubstrateChainIds
  | MiscChainIds;

export const DashboardYieldCategory = {
  RWA: "rwa",
  DeFi: "defi",
  Stake: "stake",
} as const;

export type DashboardYieldCategory =
  (typeof DashboardYieldCategory)[keyof typeof DashboardYieldCategory];

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

type SKToken = {
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly network: string;
  readonly address?: string;
  readonly logoURI?: string;
  readonly isPoints?: boolean;
  readonly coinGeckoId?: string;
};

type ActionArguments = Readonly<Record<string, unknown>> & {
  readonly amount?: string;
  readonly validatorAddress?: string;
  readonly validatorAddresses?: ReadonlyArray<string>;
  readonly tronResource?: "BANDWIDTH" | "ENERGY";
};

export type ActionMeta = {
  actionId: string;
  actionType: string;
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

export type SKTxMeta = ActionMeta & {
  txId: string;
  txType: string;
  structuredTransaction?: unknown;
  annotatedTransaction?: unknown;
  gasEstimate?: string;
};

export type SKWallet = {
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(
    tx: SKTx,
    txMeta: SKTxMeta
  ): Promise<
    | string
    | { type: "success"; txHash: string }
    | { type: "error"; error: string }
  >;
};

export type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: `${string}-${string}`;
  supportedChainIds?: SupportedSKChainIds[];
  type: "generic";
  provider: SKWallet;
};

export type VariantProps =
  | {
      variant: "zerion";
      chainModal: (args: {
        selectedChainId: number;
        chainIds: number[];
        onSwitchChain: (chainId: number) => void;
      }) => ReactNode;
    }
  | { variant: "utila" }
  | { variant: "default" }
  | { variant: "finery" }
  | { variant: "porto" };

type ThemeScale = {
  readonly [key: string]: string | ThemeScale;
};

export type SKTheme = {
  color?: ThemeScale;
  fontSize?: ThemeScale;
  letterSpacing?: ThemeScale;
  lineHeight?: ThemeScale;
  fontWeight?: ThemeScale;
  borderRadius?: ThemeScale;
  space?: ThemeScale;
  heading?: ThemeScale;
  text?: ThemeScale;
  zIndices?: ThemeScale;
  font?: ThemeScale;
};

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

export type SettingsProps = {
  apiKey: string;
  baseUrl?: string;
  borrowApiUrl?: string;
  yieldsApiUrl?: string;
  theme?: SKTheme;
  tracking?: TrackingConfig;
  onMountAnimationComplete?: () => void;
  wagmi?: {
    forceWalletConnectOnly?: boolean;
    __customConnectors__?: (chains: Chain[]) => WalletList;
  };
  externalProviders?: SKExternalProviders;
  disableGasCheck?: boolean;
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
  mapWalletListFn?: (value: WalletList) => WalletList;
  customTranslations?: Partial<
    Record<Languages, { translation: TranslationTree }>
  >;
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
  borrowEnabled?: boolean;
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

export type SKAppProps = SettingsProps &
  (VariantProps | { variant?: never; chainModal?: never });

export type BundledSKWidgetProps = SKAppProps & {
  ref?: RefObject<{ rerender: (newProps: BundledSKWidgetProps) => void }>;
};

export type HelpModalProps = {
  modal:
    | {
        type: "geoBlock";
        onClose: () => void;
        tags: Set<string>;
        countryCode: string;
        regionCode?: string;
        regionCodeName: string | undefined;
      }
    | { type: "getInTouch" }
    | { type: "whatIsStakeKit" };
  customTrigger?: ReactNode;
};
