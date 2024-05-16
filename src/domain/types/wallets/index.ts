import type { EVMWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain?: number;
  currentAddress: string;
  supportedChainIds?: number[];
  type: "generic";
  provider: EVMWallet;
};
