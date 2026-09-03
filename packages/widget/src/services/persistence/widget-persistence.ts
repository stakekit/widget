import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore";
import {
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Schema,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import type { WalletAddress } from "../../domain/identity/identifiers";
import { config } from "../../shared/config/widget-defaults";

const storageKey = <Name extends string>(name: Name) =>
  `${config.appPrefix}@1//${name}` as const;

export const widgetStorageKeys = {
  skPubKeys: storageKey("skPubKeys"),
  tosAccepted: storageKey("tosAccepted"),
} as const;

export const StoredPublicKeys = Schema.Record(Schema.String, Schema.String);
export type StoredPublicKeys = typeof StoredPublicKeys.Type;

export const TosAcknowledged = Schema.Boolean;
export type TosAcknowledged = typeof TosAcknowledged.Type;

class TosAcknowledgementPersistenceError extends Data.TaggedError(
  "TosAcknowledgementPersistenceError"
)<{
  readonly cause: unknown;
  readonly operation: "read" | "write";
}> {}

type TosAcknowledgementState =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Available"; readonly acknowledged: boolean }
  | {
      readonly _tag: "Failed";
      readonly error: TosAcknowledgementPersistenceError;
    };

const widgetStorageDefaults: {
  readonly skPubKeys: StoredPublicKeys;
  readonly tosAcknowledged: TosAcknowledged;
} = {
  skPubKeys: {},
  tosAcknowledged: false,
};

export class WidgetPersistence extends Context.Service<WidgetPersistence>()(
  "stakekit/widget/WidgetPersistence",
  {
    make: Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      const publicKeysStore = KeyValueStore.toSchemaStore(
        store,
        StoredPublicKeys
      );
      const tosStore = KeyValueStore.toSchemaStore(store, TosAcknowledged);
      const tosState = yield* SubscriptionRef.make<TosAcknowledgementState>({
        _tag: "Loading",
      });
      const tosPermit = yield* Semaphore.make(1);
      const readStoredPublicKeys = publicKeysStore
        .get(widgetStorageKeys.skPubKeys)
        .pipe(
          Effect.map(Option.getOrElse(() => widgetStorageDefaults.skPubKeys))
        );

      const readTosAcknowledgement = tosPermit.withPermits(1)(
        tosStore.get(widgetStorageKeys.tosAccepted).pipe(
          Effect.map(
            Option.getOrElse(() => widgetStorageDefaults.tosAcknowledged)
          ),
          Effect.matchEffect({
            onFailure: (cause) =>
              SubscriptionRef.set(tosState, {
                _tag: "Failed",
                error: new TosAcknowledgementPersistenceError({
                  cause,
                  operation: "read",
                }),
              }),
            onSuccess: (acknowledged) =>
              SubscriptionRef.set(tosState, {
                _tag: "Available",
                acknowledged,
              }),
          })
        )
      );
      const initializeTosAcknowledgement = yield* Effect.cached(
        readTosAcknowledgement
      );
      const tosAcknowledgementStates = Stream.unwrap(
        initializeTosAcknowledgement.pipe(
          Effect.as(SubscriptionRef.changes(tosState))
        )
      );

      return {
        acknowledgeTos: tosPermit.withPermits(1)(
          tosStore.set(widgetStorageKeys.tosAccepted, true).pipe(
            Effect.mapError(
              (cause) =>
                new TosAcknowledgementPersistenceError({
                  cause,
                  operation: "write",
                })
            ),
            Effect.andThen(
              SubscriptionRef.set(tosState, {
                _tag: "Available",
                acknowledged: true,
              })
            )
          )
        ),
        readStoredPublicKeys,
        tosAcknowledgement: {
          current: initializeTosAcknowledgement.pipe(
            Effect.andThen(SubscriptionRef.get(tosState))
          ),
          states: tosAcknowledgementStates,
        },
        upsertStoredPublicKey: Effect.fn(
          "WidgetPersistence.upsertStoredPublicKey"
        )(function* ({
          address,
          publicKey,
        }: {
          readonly address: WalletAddress;
          readonly publicKey: string;
        }) {
          const previous = yield* readStoredPublicKeys;
          yield* publicKeysStore.set(widgetStorageKeys.skPubKeys, {
            ...previous,
            [address]: publicKey,
          });
        }),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(
    WidgetPersistence,
    WidgetPersistence.make
  ).pipe(Layer.provide(BrowserKeyValueStore.layerLocalStorage));
}
