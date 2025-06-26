import type {
  DecodedBittensorTransaction,
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

type EVMTx = {
  type: "evm";
  tx: DecodedEVMTransaction;
};

type SolanaTx = {
  type: "solana";
  tx: DecodedSolanaTransaction;
};

type TonTx = {
  type: "ton";
  tx: DecodedTonTransaction;
};

export type TronTx = {
  type: "tron";
  tx: DecodedTronTransaction;
};

export type BittensorTx = {
  type: "bittensor";
  tx: DecodedBittensorTransaction;
};

export type SKTx = EVMTx | SolanaTx | TonTx | TronTx | BittensorTx;

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
} & Pick<TransactionDto, "structuredTransaction" | "annotatedTransaction">;

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
