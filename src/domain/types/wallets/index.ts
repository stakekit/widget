import type { EVMWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain: string;
  currentAddress: string;
  supportedChainIds?: number[];
} & { type: "generic"; provider: EVMWallet };
