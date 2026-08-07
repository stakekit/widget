import type SDK from "@safe-global/safe-apps-sdk";
import type {
  GatewayTransactionDetails,
  SendTransactionsResponse,
  TransactionStatus,
} from "@safe-global/safe-apps-sdk";
import type { Effect } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../../domain/types/connectors";

export const configMeta = {
  id: "safe",
  name: "Safe",
  type: "safe",
};

export type ExtraProps = ConnectorWithFilteredChains & {
  getTxStatus(txHash: string): Effect.Effect<GatewayTransactionDetails, Error>;
  txStatus: typeof TransactionStatus;
  sendTransactions(
    ...args: Parameters<SDK["txs"]["send"]>
  ): Effect.Effect<SendTransactionsResponse, Error>;
};

type SafeConnector = Connector & ExtraProps;

export const isSafeConnector = (
  connector: Connector
): connector is SafeConnector => connector.id === configMeta.id;
