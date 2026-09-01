import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  WalletCapabilityUnavailableError,
  WalletSigningError,
} from "../../../wallet-errors";
import { isCosmosConnector } from "./cosmos-connector-meta";

export const makeCosmosWalletDriver = ({
  chainWallet,
  connector,
}: {
  readonly chainWallet: ChainWalletBase | null;
  readonly connector: Connector;
}) => ({
  signTransaction: ({ tx }: { readonly tx: string }) =>
    Effect.gen(function* () {
      if (!isCosmosConnector(connector) || !chainWallet) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const signedTx = yield* connector
        .signTransaction({ cw: chainWallet, tx })
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "transaction" })
          )
        );

      return { broadcasted: false, signedTx };
    }),
});
