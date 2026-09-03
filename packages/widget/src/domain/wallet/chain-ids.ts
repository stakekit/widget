export const EvmChainIds = {
  Ethereum: 1,
  Polygon: 137,
  Optimism: 10,
  Arbitrum: 42_161,
  AvalancheC: 43_114,
  Celo: 42_220,
  Harmony: 1_666_600_000,
  Viction: 88,
  Binance: 56,
  Base: 8453,
  Linea: 59_144,
  Core: 1116,
  Sonic: 146,
  EthereumHoodi: 560_048,
  EthereumGoerli: 5,
  EthereumSepolia: 11_155_111,
  Unichain: 130,
  Katana: 747_474,
  Gnosis: 100,
  Hyperevm: 999,
  Plasma: 9745,
  Monad: 143,
  MonadTestnet: 10_143,
  Robinhood: 4663,
  RobinhoodTestnet: 46_630,
  Pharos: 1672,
} as const;

export type EvmChainIds = (typeof EvmChainIds)[keyof typeof EvmChainIds];

export const SubstrateChainIds = {
  Polkadot: 9999,
  Bittensor: 558,
} as const;

export type SubstrateChainIds =
  (typeof SubstrateChainIds)[keyof typeof SubstrateChainIds];

/** Compatibility name for non-EVM numeric Wallet Routing IDs. */
export const MiscChainIds = {
  Near: 397,
  Tezos: 1729,
  Solana: 501,
  Tron: 79,
  Ton: 3412,
  Cardano: 2000,
} as const;

export type MiscChainIds = (typeof MiscChainIds)[keyof typeof MiscChainIds];

export type SupportedSKChainIds =
  | EvmChainIds
  | SubstrateChainIds
  | MiscChainIds;
