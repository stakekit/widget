import type { ActionDto, TransactionDto } from "@stakekit/api-hooks";
import type * as TronWeb from "tronweb";
import type { Hex } from "viem";

export enum TxType {
  Legacy = "0x1",
  EIP1559 = "0x2",
}

export type EVMTx = {
  type: "evm";
  tx: {
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
};

export type SolanaTx = { type: "solana"; tx: string };

export type TonTx = {
  type: "ton";
  tx: {
    seqno: bigint;
    message: string;
  };
};

export type TronTx = {
  type: "tron";
  tx: TronWeb.Types.Transaction;
};

export type SKTx = EVMTx | SolanaTx | TonTx | TronTx;

export type SKWallet = {
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(
    tx: SKTx,
    txMeta: {
      txId: TransactionDto["id"];
      actionId: ActionDto["id"];
      actionType: ActionDto["type"];
      txType: TransactionDto["type"];
    }
  ): Promise<string>;
};
