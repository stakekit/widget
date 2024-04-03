import { GenericWallet } from "./generic-wallet";
import { SafeWalletProvider } from "./safe-wallet";

export type SKExternalProviders = {
  currentChain: string;
  currentAddress: string;
  supportedChainIds?: number[];
} & (
  | {
      type: "safe_wallet";
      provider: SafeWalletProvider;
    }
  | { type: "generic"; provider: GenericWallet }
);
