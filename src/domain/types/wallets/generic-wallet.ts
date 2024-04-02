export interface GenericWallet {
  getAccounts(): Promise<string[]>;
  getChainId(): Promise<number>;
  sendTransaction(tx: Record<string, string | number>): Promise<string>;
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: string) => Promise<void>;
}
