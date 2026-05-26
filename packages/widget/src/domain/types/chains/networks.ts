import type { TokenDto } from "../../../generated/api/yield";

export type Networks = TokenDto["network"];

type NetworkMap = Record<string, Networks>;

export const EvmNetworks = {
  Ethereum: "ethereum",
  EthereumGoerli: "ethereum-goerli",
  EthereumHolesky: "ethereum-holesky",
  EthereumSepolia: "ethereum-sepolia",
  EthereumHoodi: "ethereum-hoodi",
  Arbitrum: "arbitrum",
  Base: "base",
  BaseSepolia: "base-sepolia",
  Gnosis: "gnosis",
  Optimism: "optimism",
  Polygon: "polygon",
  PolygonAmoy: "polygon-amoy",
  Starknet: "starknet",
  zkSync: "zksync",
  Linea: "linea",
  Unichain: "unichain",
  Katana: "katana",
  MonadTestnet: "monad-testnet",
  Monad: "monad",
  AvalancheC: "avalanche-c",
  AvalancheCAtomic: "avalanche-c-atomic",
  AvalancheP: "avalanche-p",
  Binance: "binance",
  Celo: "celo",
  Fantom: "fantom",
  Harmony: "harmony",
  Moonriver: "moonriver",
  OKC: "okc",
  Viction: "viction",
  Core: "core",
  Sonic: "sonic",
  HyperEVM: "hyperevm",
  Plasma: "plasma",
} as const satisfies NetworkMap;

export type EvmNetworks = (typeof EvmNetworks)[keyof typeof EvmNetworks];

export const CosmosNetworks = {
  Agoric: "agoric",
  Akash: "akash",
  Axelar: "axelar",
  BandProtocol: "band-protocol",
  Bitsong: "bitsong",
  Canto: "canto",
  Chihuahua: "chihuahua",
  Comdex: "comdex",
  Coreum: "coreum",
  Cosmos: "cosmos",
  Crescent: "crescent",
  Cronos: "cronos",
  Cudos: "cudos",
  Desmos: "desmos",
  Dydx: "dydx",
  Evmos: "evmos",
  FetchAi: "fetch-ai",
  GravityBridge: "gravity-bridge",
  Injective: "injective",
  IRISnet: "irisnet",
  Juno: "juno",
  Kava: "kava",
  KiNetwork: "ki-network",
  MarsProtocol: "mars-protocol",
  NYM: "nym",
  OKExChain: "okex-chain",
  Onomy: "onomy",
  Osmosis: "osmosis",
  Persistence: "persistence",
  Quicksilver: "quicksilver",
  Regen: "regen",
  Secret: "secret",
  Sentinel: "sentinel",
  Sommelier: "sommelier",
  StaFi: "stafi",
  Stargaze: "stargaze",
  Stride: "stride",
  Teritori: "teritori",
  TGrade: "tgrade",
  Umee: "umee",
  Sei: "sei",
  Mantra: "mantra",
  Celestia: "celestia",
  Saga: "saga",
  Zetachain: "zetachain",
  Dymension: "dymension",
  HumansAi: "humansai",
  Neutron: "neutron",
} as const satisfies NetworkMap;

export type CosmosNetworks =
  (typeof CosmosNetworks)[keyof typeof CosmosNetworks];

export const SubstrateNetworks = {
  Polkadot: "polkadot",
  Westend: "westend",
  Kusama: "kusama",
  Bittensor: "bittensor",
} as const satisfies NetworkMap;

export type SubstrateNetworks =
  (typeof SubstrateNetworks)[keyof typeof SubstrateNetworks];

export const MiscNetworks = {
  BinanceBeacon: "binancebeacon",
  Cardano: "cardano",
  Near: "near",
  Solana: "solana",
  SolanaDevnet: "solana-devnet",
  Tezos: "tezos",
  Tron: "tron",
  Ton: "ton",
  TonTestnet: "ton-testnet",
  Aptos: "aptos",
  Stellar: "stellar",
  StellarTestnet: "stellar-testnet",
  Sui: "sui",
} as const satisfies NetworkMap;

export type MiscNetworks = (typeof MiscNetworks)[keyof typeof MiscNetworks];

export const Networks = {
  ...MiscNetworks,
  ...SubstrateNetworks,
  ...CosmosNetworks,
  ...EvmNetworks,
} as const satisfies NetworkMap;
