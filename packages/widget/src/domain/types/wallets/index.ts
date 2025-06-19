import type { SupportedSKChainIds } from "@sk-widget/domain/types/chains";
import type { TokenString } from "@sk-widget/domain/types/tokens";
import type { SKWallet } from "./generic-wallet";

export type SKExternalProviders = {
  currentChain?: SupportedSKChainIds;
  currentAddress: string;
  initToken?: TokenString;
  supportedChainIds?: SupportedSKChainIds[];
  type: "generic";
  provider: SKWallet;
};
