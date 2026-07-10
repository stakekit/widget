import type { ChainWalletBase } from "@cosmos-kit/core";
import { useAtomValue } from "@effect/atom-react";
import { Data, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Connector } from "wagmi";
import { AdditionalAddresses } from "../../domain/schema/address-models";
import { getStorageItem } from "../../services/local-storage";
import type { CosmosConnector } from "../cosmos/cosmos-connector-meta";
import { isCosmosConnector } from "../cosmos/cosmos-connector-meta";
import { useCosmosCW } from "./use-cosmos-cw";

class AdditionalAddressesKey extends Data.Class<{
  readonly address: string | null;
  readonly chainWallet: ChainWalletBase | null;
  readonly connector: Connector | null;
  readonly isConnected: boolean;
}> {}

class AdditionalAddressesError extends Data.TaggedError(
  "AdditionalAddressesError"
)<{
  readonly cause: unknown;
}> {}

const getCosmosPubKey = ({
  chainWallet,
  connector,
}: {
  readonly chainWallet: ChainWalletBase;
  readonly connector: CosmosConnector;
}) =>
  Effect.gen(function* () {
    const storedPublicKeys = getStorageItem("sk-widget@1//skPubKeys")
      .toMaybe()
      .extractNullable();
    const accounts = yield* Effect.tryPromise({
      try: () => connector.getAccounts(),
      catch: (cause) => new AdditionalAddressesError({ cause }),
    });
    const storedPublicKey = accounts[0]
      ? storedPublicKeys?.[accounts[0]]
      : undefined;

    if (storedPublicKey) return storedPublicKey;

    const account = yield* Effect.tryPromise({
      try: () => chainWallet.client.getAccount!(chainWallet.chainId),
      catch: (cause) => new AdditionalAddressesError({ cause }),
    });

    return connector.toBase64(account.pubkey);
  });

const additionalAddressesAtom = Atom.family((key: AdditionalAddressesKey) =>
  Atom.make(() =>
    Effect.gen(function* () {
      if (
        !key.isConnected ||
        !key.address ||
        !key.chainWallet ||
        !key.connector ||
        !isCosmosConnector(key.connector)
      ) {
        return null;
      }

      const cosmosPubKey = yield* getCosmosPubKey({
        chainWallet: key.chainWallet,
        connector: key.connector,
      });

      return yield* Schema.decodeUnknownEffect(AdditionalAddresses)({
        cosmosPubKey,
      }).pipe(
        Effect.mapError((cause) => new AdditionalAddressesError({ cause }))
      );
    })
  ).pipe(Atom.setIdleTTL(0))
);

export const useAdditionalAddresses = ({
  connector,
  address,
  isConnected,
}: {
  isConnected: boolean;
  connector: Connector | undefined;
  address: string | undefined;
}) => {
  const chainWallet = useCosmosCW(connector);
  const result = useAtomValue(
    additionalAddressesAtom(
      new AdditionalAddressesKey({
        address: address ?? null,
        chainWallet: chainWallet ?? null,
        connector: connector ?? null,
        isConnected,
      })
    )
  );

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  };
};
