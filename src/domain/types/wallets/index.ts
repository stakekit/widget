import { GenericWallet } from "./generic-wallet";
import { SafeWalletProvider } from "./safe-wallet";

export type SKExternalProviders = { supportedChainIds?: number[] } & (
  | {
      type: "safe_wallet";
      provider: SafeWalletProvider;
    }
  | { type: "generic"; provider: GenericWallet }
);
