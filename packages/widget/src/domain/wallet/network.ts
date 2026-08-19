import {
  type CosmosNetworks,
  type EvmNetworks,
  isEvmNetwork,
  type MiscNetworks,
  type SubstrateNetworks,
} from "../network/networks";

export type WalletEvmNetwork =
  | typeof EvmNetworks.AvalancheC
  | typeof EvmNetworks.Arbitrum
  | typeof EvmNetworks.Binance
  | typeof EvmNetworks.Celo
  | typeof EvmNetworks.Ethereum
  | typeof EvmNetworks.EthereumGoerli
  | typeof EvmNetworks.Harmony
  | typeof EvmNetworks.Optimism
  | typeof EvmNetworks.Polygon
  | typeof EvmNetworks.Viction
  | typeof EvmNetworks.EthereumHoodi
  | typeof EvmNetworks.Base
  | typeof EvmNetworks.Linea
  | typeof EvmNetworks.Core
  | typeof EvmNetworks.Sonic
  | typeof EvmNetworks.EthereumSepolia
  | typeof EvmNetworks.Unichain
  | typeof EvmNetworks.Katana
  | typeof EvmNetworks.Gnosis
  | typeof EvmNetworks.HyperEVM
  | typeof EvmNetworks.Plasma
  | typeof EvmNetworks.Monad
  | typeof EvmNetworks.MonadTestnet
  | typeof EvmNetworks.Pharos;

export type WalletCosmosNetwork =
  | typeof CosmosNetworks.Akash
  | typeof CosmosNetworks.Cosmos
  | typeof CosmosNetworks.Juno
  | typeof CosmosNetworks.Kava
  | typeof CosmosNetworks.Osmosis
  | typeof CosmosNetworks.Stargaze
  | typeof CosmosNetworks.Onomy
  | typeof CosmosNetworks.Persistence
  | typeof CosmosNetworks.Axelar
  | typeof CosmosNetworks.Quicksilver
  | typeof CosmosNetworks.Agoric
  | typeof CosmosNetworks.BandProtocol
  | typeof CosmosNetworks.Bitsong
  | typeof CosmosNetworks.Chihuahua
  | typeof CosmosNetworks.Comdex
  | typeof CosmosNetworks.Crescent
  | typeof CosmosNetworks.Cronos
  | typeof CosmosNetworks.Cudos
  | typeof CosmosNetworks.FetchAi
  | typeof CosmosNetworks.GravityBridge
  | typeof CosmosNetworks.IRISnet
  | typeof CosmosNetworks.KiNetwork
  | typeof CosmosNetworks.MarsProtocol
  | typeof CosmosNetworks.Regen
  | typeof CosmosNetworks.Secret
  | typeof CosmosNetworks.Sentinel
  | typeof CosmosNetworks.Sommelier
  | typeof CosmosNetworks.Teritori
  | typeof CosmosNetworks.Umee
  | typeof CosmosNetworks.Coreum
  | typeof CosmosNetworks.Desmos
  | typeof CosmosNetworks.Dydx
  | typeof CosmosNetworks.Injective
  | typeof CosmosNetworks.Sei
  | typeof CosmosNetworks.Mantra;

export type WalletMiscNetwork =
  | typeof MiscNetworks.Near
  | typeof MiscNetworks.Tezos
  | typeof MiscNetworks.Solana
  | typeof MiscNetworks.Tron
  | typeof MiscNetworks.Ton
  | typeof MiscNetworks.Cardano;

export type WalletSubstrateNetwork =
  | typeof SubstrateNetworks.Polkadot
  | typeof SubstrateNetworks.Bittensor;

export type WalletNetwork =
  | WalletCosmosNetwork
  | WalletEvmNetwork
  | WalletMiscNetwork
  | WalletSubstrateNetwork;

export const isEvmWalletNetwork = (
  network: WalletNetwork
): network is WalletEvmNetwork => isEvmNetwork(network);
