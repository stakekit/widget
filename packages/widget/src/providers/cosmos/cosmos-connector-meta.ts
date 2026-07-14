import type { toBase64 } from "@cosmjs/encoding";
import type { ChainWalletBase } from "@cosmos-kit/core";
import type { Effect, Stream } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";

export const configMeta = { type: "cosmosProvider" };

export type ExtraProps = ConnectorWithFilteredChains & {
  $chainWallet: Stream.Stream<ChainWalletBase>;
  signTransaction: ({
    cw,
    tx,
  }: {
    cw: ChainWalletBase;
    tx: string;
  }) => Effect.Effect<string, Error>;
  toBase64: typeof toBase64;
};

export type CosmosConnector = Connector & ExtraProps;

export const isCosmosConnector = (
  connector: Connector
): connector is CosmosConnector => connector.type === configMeta.type;
