import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { type PropsWithChildren, useMemo } from "react";
import { config } from "../../config";

const network = WalletAdapterNetwork.Mainnet;

const endpoint = clusterApiUrl(network);

export const SolanaProvider = ({ children }: PropsWithChildren) => {
  const wallets = useMemo(() => {
    return config.env.isTestMode
      ? []
      : [new PhantomWalletAdapter(), new TrustWalletAdapter()];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>{children}</WalletProvider>
    </ConnectionProvider>
  );
};
