import type { TokenString } from "@sk-widget/domain/types";
import type { EVMWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain?: number;
  currentAddress: string;
  initToken?: TokenString;
  supportedChainIds?: number[];
  type: "generic";
  provider: EVMWallet;
};
