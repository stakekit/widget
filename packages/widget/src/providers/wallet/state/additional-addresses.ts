import type { ChainWalletBase } from "@cosmos-kit/core";
import { Data, Effect, Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { AdditionalAddresses } from "../../../domain/schema/address-models";
import {
  WalletAddress,
  type WalletAddress as WalletAddressType,
} from "../../../domain/schema/identifiers";
import {
  type CosmosConnector,
  isCosmosConnector,
} from "../../cosmos/cosmos-connector-meta";
import { readStoredPublicKeys } from "../../effect-atom-runtime/persistence";
import { widgetAtomRuntime } from "../../effect-atom-runtime/widget-runtime";
import type { WalletConnectionSnapshot } from "./connection";

export class AdditionalAddressesError extends Data.TaggedError(
  "AdditionalAddressesError"
)<{
  readonly cause: unknown;
}> {}

export const getCosmosAdditionalAddresses = ({
  address,
  chainWallet,
  connector,
}: {
  readonly address: WalletAddressType;
  readonly chainWallet: ChainWalletBase;
  readonly connector: CosmosConnector;
}) =>
  Effect.gen(function* () {
    const storedPublicKeys = yield* readStoredPublicKeys;
    const storedPublicKey = storedPublicKeys[address];
    const cosmosPubKey = storedPublicKey
      ? storedPublicKey
      : yield* Effect.tryPromise({
          try: () =>
            chainWallet.client.getAccount!(chainWallet.chainId).then(
              (account) => connector.toBase64(account.pubkey)
            ),
          catch: (cause) => new AdditionalAddressesError({ cause }),
        });

    return yield* Schema.decodeEffect(AdditionalAddresses)({
      cosmosPubKey,
    }).pipe(
      Effect.mapError((cause) => new AdditionalAddressesError({ cause }))
    );
  });

export const makeAdditionalAddressesAtom = <ConnectionError, CosmosStateError>(
  connectionAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletConnectionSnapshot, ConnectionError>
  >,
  cosmosChainWalletAtom: Atom.Atom<
    AsyncResult.AsyncResult<ChainWalletBase | null, CosmosStateError>
  >
) =>
  widgetAtomRuntime
    .atom(
      (get) =>
        Effect.gen(function* () {
          const [connection, chainWallet] = yield* Effect.all([
            get.result(connectionAtom),
            get.result(cosmosChainWalletAtom),
          ]);
          const connector = connection.connector;

          if (
            !connection.isConnected ||
            !connection.address ||
            !chainWallet ||
            !connector ||
            !isCosmosConnector(connector)
          ) {
            return null;
          }

          return yield* getCosmosAdditionalAddresses({
            address: Schema.decodeSync(WalletAddress)(connection.address),
            chainWallet,
            connector,
          });
        }),
      { initialValue: null }
    )
    .pipe(Atom.setIdleTTL(0));
