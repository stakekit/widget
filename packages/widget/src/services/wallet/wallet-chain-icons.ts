import arbitrum from "./internal/adapters/evm/icons/chains/arbitrum.svg";
import avalanche from "./internal/adapters/evm/icons/chains/avalanche.svg";
import base from "./internal/adapters/evm/icons/chains/base.svg";
import binance from "./internal/adapters/evm/icons/chains/binance.svg";
import celo from "./internal/adapters/evm/icons/chains/celo.svg";
import ethereum from "./internal/adapters/evm/icons/chains/ethereum.svg";
import gnosis from "./internal/adapters/evm/icons/chains/gnosis.svg";
import hyperevm from "./internal/adapters/evm/icons/chains/hyperevm.svg";
import linea from "./internal/adapters/evm/icons/chains/linea.svg";
import monad from "./internal/adapters/evm/icons/chains/monad.svg";
import optimism from "./internal/adapters/evm/icons/chains/optimism.svg";
import polygon from "./internal/adapters/evm/icons/chains/polygon.svg";
import unichain from "./internal/adapters/evm/icons/chains/unichain.svg";
import type { Chain } from "./wallet-descriptors";

type ChainIcon = Pick<Chain, "iconUrl" | "iconBackground">;

const chainIcons: Readonly<Partial<Record<number, ChainIcon>>> = {
  1: { iconUrl: ethereum, iconBackground: "#484c50" },
  5: { iconUrl: ethereum, iconBackground: "#484c50" },
  11155111: { iconUrl: ethereum, iconBackground: "#484c50" },
  137: { iconUrl: polygon, iconBackground: "#9f71ec" },
  10: { iconUrl: optimism, iconBackground: "#ff5a57" },
  42161: { iconUrl: arbitrum, iconBackground: "#96bedc" },
  43114: { iconUrl: avalanche, iconBackground: "#e84141" },
  8453: { iconUrl: base, iconBackground: "#0052ff" },
  56: { iconUrl: binance, iconBackground: "#ebac0e" },
  100: { iconUrl: gnosis, iconBackground: "#04795c" },
  42220: { iconUrl: celo, iconBackground: "#FCFF52" },
  130: { iconUrl: unichain, iconBackground: "#F50DB4" },
  59144: { iconUrl: linea, iconBackground: "#ffffff" },
  10143: { iconUrl: monad, iconBackground: "transparent" },
  999: { iconUrl: hyperevm, iconBackground: "#000000" },
};

export const walletChainIcon = (chain: Chain): ChainIcon => ({
  iconUrl: chain.iconUrl ?? chainIcons[chain.id]?.iconUrl,
  iconBackground: chain.iconBackground ?? chainIcons[chain.id]?.iconBackground,
});
