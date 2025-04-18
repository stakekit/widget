import type { ActionDto, TransactionDto } from "@stakekit/api-hooks";
import type { Hex } from "viem";

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
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: string) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(
    tx: EVMTx,
    txMeta: { txId: TransactionDto["id"]; actionId: ActionDto["id"] }
  ): Promise<string>;
};
