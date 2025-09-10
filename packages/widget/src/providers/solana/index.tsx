import {
  type Adapter,
  WalletAdapterNetwork,
} from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  BitgetWalletAdapter,
  PhantomWalletAdapter,
  TrustWalletAdapter,
  // WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import type { PropsWithChildren } from "react";

// import { config } from "../../config";

const network = WalletAdapterNetwork.Mainnet;

const endpoint = clusterApiUrl(network);

const wallets: Adapter[] = [
  new PhantomWalletAdapter(),
  new BitgetWalletAdapter(),
  new TrustWalletAdapter(),
  // new WalletConnectWalletAdapter({
  //   network,
  //   options: {
  //     projectId: config.walletConnectV2.projectId,
  //   },
  // }),
];

export const SolanaProvider = ({ children }: PropsWithChildren) => {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>{children}</WalletProvider>
    </ConnectionProvider>
  );
};
