/**
 * Safe Wallet provider
 */
export type SafeWalletAppInfo = {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
};

type SafeWalletTransactionReceipt = {
  hash?: string;
  transactionHash?: string;
  blockHash?: string;
};

interface SafeWalletProvider {
  getAccounts(): Promise<string[]>;
  getChainId(): Promise<string>;
  switchEthereumChain(
    { chainId }: { chainId: string },
    appInfo: SafeWalletAppInfo
  ): Promise<null>;
  getTransactionReceipt(
    txHash: string
  ): Promise<SafeWalletTransactionReceipt | null>;
  sendTransactions: ({
    txs,
  }: {
    txs: {
      gas: string | number;
      to: string;
      value: string;
      data: string;
    }[];
    appInfo: SafeWalletAppInfo;
  }) => Promise<{ hash: string }>;
}

export type SKExternalProviders = {
  type: "safe_wallet";
  provider: SafeWalletProvider;
};
