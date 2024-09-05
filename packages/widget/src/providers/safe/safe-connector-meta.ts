import type {
  GatewayTransactionDetails,
  SendTransactionsResponse,
  TransactionStatus,
} from "@safe-global/safe-apps-sdk";
import type SDK from "@safe-global/safe-apps-sdk";
import type { ConnectorWithFilteredChains } from "@sk-widget/domain/types/connectors";
import type { EitherAsync } from "purify-ts";
import type { Connector } from "wagmi";

export const configMeta = {
  id: "safe",
  name: "Safe",
  type: "safe",
};

export type ExtraProps = ConnectorWithFilteredChains & {
  getTxStatus(txHash: string): EitherAsync<Error, GatewayTransactionDetails>;
  txStatus: typeof TransactionStatus;
  sendTransactions(
    ...args: Parameters<SDK["txs"]["send"]>
  ): EitherAsync<Error, SendTransactionsResponse>;
};

type SafeConnector = Connector & ExtraProps;

export const isSafeConnector = (
  connector: Connector
): connector is SafeConnector => connector.id === configMeta.id;
