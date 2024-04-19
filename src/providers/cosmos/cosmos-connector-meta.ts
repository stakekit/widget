import type { ChainWalletBase } from "@cosmos-kit/core";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { Observable } from "rxjs";
import type { Connector } from "wagmi";
import type { EitherAsync } from "purify-ts";
import type { toBase64 } from "@cosmjs/encoding";

export const configMeta = { type: "cosmosProvider" };

export type ExtraProps = ConnectorWithFilteredChains & {
  $chainWallet: Observable<ChainWalletBase>;
  signTransaction: ({
    cw,
    tx,
  }: {
    cw: ChainWalletBase;
    tx: string;
  }) => EitherAsync<Error, string>;
  toBase64: typeof toBase64;
};

export type CosmosConnector = Connector & ExtraProps;

export const isCosmosConnector = (
  connector: Connector
): connector is CosmosConnector => connector.type === configMeta.type;
