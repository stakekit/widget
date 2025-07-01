import type { SupportedSKChainIds } from "../chains";
import type { TokenString } from "../tokens";
import type { SKWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: TokenString;
  supportedChainIds?: SupportedSKChainIds[];
  type: "generic";
  provider: SKWallet;
};
