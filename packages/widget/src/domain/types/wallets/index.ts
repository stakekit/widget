import type { TokenString } from "@sk-widget/domain/types";
import type { SupportedSKChainIds } from "@sk-widget/domain/types/chains";
import type { SKWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: TokenString;
  supportedChainIds?: number[];
  type: "generic";
  provider: SKWallet;
};
