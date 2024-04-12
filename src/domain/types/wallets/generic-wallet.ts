import { Hex } from "viem";

export enum TxType {
  Legacy = "0x1",
  EIP1559 = "0x2",
}

export type EVMTx = {
  data: Hex;
  from: Hex;
  to: Hex;
  value: Hex | undefined;
  nonce: Hex;
  gas: Hex;
  chainId: Hex;
  type: Hex;
} & (
  | {
      type: TxType.EIP1559; // EIP-1559
      maxFeePerGas: Hex | undefined;
      maxPriorityFeePerGas: Hex | undefined;
    }
  | { type: TxType.Legacy } // Legacy
);

export type EVMWallet = {
  getAccounts(): Promise<string[]>;
  getChainId(): Promise<number>;
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: string) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
} & (
  | { sendTransaction(tx: EVMTx): Promise<string>; sendTransactions?: never }
  | {
      sendTransaction?: never;
      sendTransactions(tx: EVMTx[]): Promise<string>;
    }
);
