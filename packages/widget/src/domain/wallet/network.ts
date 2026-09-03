import { Schema } from "effect";
import type { Network } from "../network/network";
import { EvmChainIds, MiscChainIds, SubstrateChainIds } from "./chain-ids.ts";

export type WalletProtocolFamily =
  | "evm"
  | "cosmos"
  | "substrate"
  | "near"
  | "tezos"
  | "solana"
  | "tron"
  | "ton"
  | "cardano"
  | "stellar";

type ProtocolChainIdentity =
  | { readonly type: "evm"; readonly chainId: number }
  | { readonly type: "cosmos"; readonly chainId: string }
  | { readonly type: "substrate"; readonly genesisHash: `0x${string}` }
  | { readonly type: "stellar"; readonly networkPassphrase: string }
  | { readonly type: "unmodelled" };

type WalletNetworkMetadata = Readonly<{
  protocolFamily: WalletProtocolFamily;
  protocolChainIdentity: ProtocolChainIdentity;
  walletRoutingId: number | string;
}>;

const evm = <const ChainId extends EvmChainIds>(chainId: ChainId) =>
  ({
    protocolFamily: "evm",
    protocolChainIdentity: { type: "evm", chainId },
    walletRoutingId: chainId,
  }) as const;

const cosmos = <const ChainId extends string>(chainId: ChainId) =>
  ({
    protocolFamily: "cosmos",
    protocolChainIdentity: { type: "cosmos", chainId },
    walletRoutingId: chainId,
  }) as const;

const unmodelled = <
  const Family extends Exclude<
    WalletProtocolFamily,
    "evm" | "cosmos" | "stellar" | "substrate"
  >,
  const RoutingId extends MiscChainIds,
>(
  protocolFamily: Family,
  walletRoutingId: RoutingId
) =>
  ({
    protocolFamily,
    protocolChainIdentity: { type: "unmodelled" },
    walletRoutingId,
  }) as const;

const stellar = <
  const NetworkPassphrase extends string,
  const RoutingId extends number,
>(
  networkPassphrase: NetworkPassphrase,
  walletRoutingId: RoutingId
) =>
  ({
    protocolFamily: "stellar",
    protocolChainIdentity: { type: "stellar", networkPassphrase },
    walletRoutingId,
  }) as const;

const walletNetworkCatalog = {
  "avalanche-c": evm(EvmChainIds.AvalancheC),
  arbitrum: evm(EvmChainIds.Arbitrum),
  binance: evm(EvmChainIds.Binance),
  celo: evm(EvmChainIds.Celo),
  ethereum: evm(EvmChainIds.Ethereum),
  "ethereum-goerli": evm(EvmChainIds.EthereumGoerli),
  harmony: evm(EvmChainIds.Harmony),
  optimism: evm(EvmChainIds.Optimism),
  polygon: evm(EvmChainIds.Polygon),
  viction: evm(EvmChainIds.Viction),
  "ethereum-hoodi": evm(EvmChainIds.EthereumHoodi),
  base: evm(EvmChainIds.Base),
  linea: evm(EvmChainIds.Linea),
  core: evm(EvmChainIds.Core),
  sonic: evm(EvmChainIds.Sonic),
  "ethereum-sepolia": evm(EvmChainIds.EthereumSepolia),
  unichain: evm(EvmChainIds.Unichain),
  katana: evm(EvmChainIds.Katana),
  gnosis: evm(EvmChainIds.Gnosis),
  hyperevm: evm(EvmChainIds.Hyperevm),
  plasma: evm(EvmChainIds.Plasma),
  monad: evm(EvmChainIds.Monad),
  "monad-testnet": evm(EvmChainIds.MonadTestnet),
  robinhood: evm(EvmChainIds.Robinhood),
  "robinhood-testnet": evm(EvmChainIds.RobinhoodTestnet),
  pharos: evm(EvmChainIds.Pharos),
  akash: cosmos("akashnet-2"),
  cosmos: cosmos("cosmoshub-4"),
  juno: cosmos("juno-1"),
  kava: cosmos("kava_2222-10"),
  osmosis: cosmos("osmosis-1"),
  stargaze: cosmos("stargaze-1"),
  onomy: cosmos("onomy-mainnet-1"),
  persistence: cosmos("core-1"),
  axelar: cosmos("axelar-dojo-1"),
  quicksilver: cosmos("quicksilver-2"),
  agoric: cosmos("agoric-3"),
  "band-protocol": cosmos("laozi-mainnet"),
  bitsong: cosmos("bitsong-2b"),
  chihuahua: cosmos("chihuahua-1"),
  comdex: cosmos("comdex-1"),
  crescent: cosmos("crescent-1"),
  cronos: cosmos("crypto-org-chain-mainnet-1"),
  cudos: cosmos("cudos-1"),
  "fetch-ai": cosmos("fetchhub-4"),
  "gravity-bridge": cosmos("gravity-bridge-3"),
  irisnet: cosmos("irishub-1"),
  "ki-network": cosmos("kichain-2"),
  "mars-protocol": cosmos("mars-1"),
  regen: cosmos("regen-1"),
  secret: cosmos("secret-4"),
  sentinel: cosmos("sentinelhub-2"),
  sommelier: cosmos("sommelier-3"),
  teritori: cosmos("teritori-1"),
  umee: cosmos("umee-1"),
  coreum: cosmos("coreum-mainnet-1"),
  desmos: cosmos("desmos-mainnet"),
  dydx: cosmos("dydx-mainnet-1"),
  injective: cosmos("injective-1"),
  sei: cosmos("pacific-1"),
  mantra: cosmos("mantra-1"),
  near: unmodelled("near", MiscChainIds.Near),
  tezos: unmodelled("tezos", MiscChainIds.Tezos),
  solana: unmodelled("solana", MiscChainIds.Solana),
  tron: unmodelled("tron", MiscChainIds.Tron),
  ton: unmodelled("ton", MiscChainIds.Ton),
  cardano: unmodelled("cardano", MiscChainIds.Cardano),
  stellar: stellar("Public Global Stellar Network ; September 2015", 148),
  polkadot: {
    protocolFamily: "substrate",
    protocolChainIdentity: {
      type: "substrate",
      genesisHash:
        "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
    },
    walletRoutingId: SubstrateChainIds.Polkadot,
  },
  bittensor: {
    protocolFamily: "substrate",
    protocolChainIdentity: {
      type: "substrate",
      genesisHash:
        "0x2f0555cc76fc2840a25a6ea3b9637146806f1f44b090c175ffde2a7e5ab36c03",
    },
    walletRoutingId: SubstrateChainIds.Bittensor,
  },
} as const satisfies Partial<Record<Network, WalletNetworkMetadata>>;

export type WalletNetwork = keyof typeof walletNetworkCatalog;

type WalletNetworkForProtocol<Family extends WalletProtocolFamily> = {
  [Key in WalletNetwork]: (typeof walletNetworkCatalog)[Key]["protocolFamily"] extends Family
    ? Key
    : never;
}[WalletNetwork];

export type WalletEvmNetwork = WalletNetworkForProtocol<"evm">;
export type WalletCosmosNetwork = WalletNetworkForProtocol<"cosmos">;
export type WalletSubstrateNetwork = WalletNetworkForProtocol<"substrate">;
export type WalletMiscNetwork = Exclude<
  WalletNetwork,
  WalletEvmNetwork | WalletCosmosNetwork | WalletSubstrateNetwork
>;

const walletNetworks = Object.keys(walletNetworkCatalog) as [
  WalletNetwork,
  ...WalletNetwork[],
];

export const WalletNetwork = Schema.Literals(walletNetworks);

const networksForProtocol = <Family extends WalletProtocolFamily>(
  protocolFamily: Family
): ReadonlyArray<WalletNetworkForProtocol<Family>> =>
  walletNetworks.filter(
    (network): network is WalletNetworkForProtocol<Family> =>
      walletNetworkCatalog[network].protocolFamily === protocolFamily
  );

const walletEvmNetworks = networksForProtocol("evm");
export const walletCosmosNetworks = networksForProtocol("cosmos");

const walletEvmNetworkSet = new Set<WalletNetwork>(walletEvmNetworks);
const walletCosmosNetworkSet = new Set<WalletNetwork>(walletCosmosNetworks);

export const getWalletProtocolFamily = <NetworkId extends WalletNetwork>(
  network: NetworkId
): (typeof walletNetworkCatalog)[NetworkId]["protocolFamily"] =>
  walletNetworkCatalog[network].protocolFamily;

export const getWalletRoutingId = <NetworkId extends WalletNetwork>(
  network: NetworkId
): (typeof walletNetworkCatalog)[NetworkId]["walletRoutingId"] =>
  walletNetworkCatalog[network].walletRoutingId;

export const getProtocolChainIdentity = <NetworkId extends WalletNetwork>(
  network: NetworkId
): (typeof walletNetworkCatalog)[NetworkId]["protocolChainIdentity"] =>
  walletNetworkCatalog[network].protocolChainIdentity;

export const isEvmWalletNetwork = (
  network: string
): network is WalletEvmNetwork =>
  walletEvmNetworkSet.has(network as WalletNetwork);

export const isCosmosWalletNetwork = (
  network: string
): network is WalletCosmosNetwork =>
  walletCosmosNetworkSet.has(network as WalletNetwork);

export const isWalletNetwork = Schema.is(WalletNetwork);
