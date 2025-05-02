import type {
  DecodedEVMTransaction,
  DecodedSolanaTransaction,
  DecodedTonTransaction,
  DecodedTronTransaction,
} from "@sk-widget/domain/types/transaction";
import type {
  ActionDto,
  RewardTypes,
  TransactionDto,
} from "@stakekit/api-hooks";

export type EVMTx = {
  type: "evm";
  tx: DecodedEVMTransaction;
};

export type SolanaTx = {
  type: "solana";
  tx: DecodedSolanaTransaction;
};

export type TonTx = {
  type: "ton";
  tx: DecodedTonTransaction;
};

export type TronTx = {
  type: "tron";
  tx: DecodedTronTransaction;
};

export type SKTx = EVMTx | SolanaTx | TonTx | TronTx;

export type ActionMeta = {
  actionId: ActionDto["id"];
  actionType: ActionDto["type"];
  amount: ActionDto["amount"];
  inputToken: ActionDto["inputToken"];
  providersDetails: {
    name: string;
    address: string | undefined;
    rewardRate: number | undefined;
    rewardType: RewardTypes;
    website: string | undefined;
    logo: string | undefined;
  }[];
};

export type SKTxMeta = ActionMeta & {
  txId: TransactionDto["id"];
  txType: TransactionDto["type"];
};

export type SKWallet = {
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getTransactionReceipt?(txHash: string): Promise<{ transactionHash?: string }>;
  sendTransaction(
    tx: SKTx,
    txMeta: SKTxMeta
  ): Promise<
    | string
    | { type: "success"; txHash: string }
    | { type: "error"; error: string }
  >;
};
