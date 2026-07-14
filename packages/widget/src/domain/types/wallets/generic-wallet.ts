import type {
  ActionTransaction,
  YieldAction,
} from "../../schema/action-models";
import type { AppToken } from "../../schema/legacy-models";
import type {
  DecodedEVMTransaction,
  DecodedSolanaTransaction,
  DecodedSubstrateTransaction,
  DecodedTonTransaction,
  DecodedTronTransaction,
} from "../../types/transaction";

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
  tx: DecodedSubstrateTransaction;
};

export type SKTx = EVMTx | SolanaTx | TonTx | TronTx | BittensorTx;

export type ActionMeta = {
  actionId: YieldAction["id"];
  actionType: YieldAction["type"];
  address?: YieldAction["address"];
  amount: YieldAction["amount"];
  amountRaw?: YieldAction["amountRaw"];
  rawArguments?: YieldAction["rawArguments"];
  yieldId?: YieldAction["yieldId"];
  inputToken: AppToken | undefined;
  providersDetails: {
    name: string;
    address: string | undefined;
    rewardRate: number | undefined;
    rewardType: string | undefined;
    website: string | undefined;
    logo: string | undefined;
  }[];
};

export type SKTxMeta = ActionMeta & {
  txId: ActionTransaction["id"];
  txType: ActionTransaction["type"];
} & Pick<
    ActionTransaction,
    "structuredTransaction" | "annotatedTransaction" | "gasEstimate"
  >;

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
