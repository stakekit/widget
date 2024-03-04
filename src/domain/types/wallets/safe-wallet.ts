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

export type SafeWalletTransactionReceipt = {
  hash?: string;
  transactionHash?: string;
  blockHash?: string;
};

interface SafeWalletProvider {
  eth_accounts(): Promise<string[]>;
  eth_chainId(): Promise<string>;
  eth_sendTransaction(
    tx: {
      gas: string | number;
      to: string;
      value: string;
      data: string;
    },
    appInfo: SafeWalletAppInfo
  ): Promise<string>;
  wallet_switchEthereumChain(
    { chainId }: { chainId: string },
    appInfo: SafeWalletAppInfo
  ): Promise<null>;
  eth_getTransactionReceipt(
    txHash: string
  ): Promise<SafeWalletTransactionReceipt | null>;
}

enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

interface MetaTransactionData {
  to: string;
  value: string;
  data: string;
  operation?: OperationType;
}

interface TransactionOptions {
  from?: string;
  gas?: number | string;
  gasLimit?: number | string;
  gasPrice?: number | string;
  maxFeePerGas?: number | string;
  maxPriorityFeePerGas?: number | string;
  nonce?: number;
}

interface TransactionBase {
  to: string;
  value: string;
  data: string;
}

type Transaction = TransactionBase & TransactionOptions;

export type SKExternalProviders = {
  type: "safe_wallet";
  provider: SafeWalletProvider;
  createTransactionBatch(
    transactions: MetaTransactionData[],
    transactionOptions?: TransactionOptions
  ): Promise<Transaction>;
};
