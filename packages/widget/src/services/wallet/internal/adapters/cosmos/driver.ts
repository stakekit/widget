import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  requireTransactionSigner,
  signedPayloadResult,
} from "../transaction-signing";
import {
  type CosmosChainWallet,
  isCosmosConnector,
} from "./cosmos-connector-meta";

export const makeCosmosWalletDriver = ({
  chainWallet,
  connector,
}: {
  readonly chainWallet: CosmosChainWallet | null;
  readonly connector: Connector;
}) => ({
  signTransaction: ({ tx }: { readonly tx: string }) =>
    requireTransactionSigner(
      connector,
      isCosmosConnector(connector) && chainWallet
        ? { cosmos: connector, cw: chainWallet }
        : null
    ).pipe(
      Effect.flatMap(({ cosmos, cw }) =>
        signedPayloadResult(cosmos.signTransaction({ cw, tx }))
      )
    ),
});
