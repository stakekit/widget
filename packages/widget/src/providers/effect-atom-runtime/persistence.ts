import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore";
import { Context, Effect, Layer, Option, Schema } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { config } from "../../config";
import type { WalletAddress } from "../../domain/schema/identifiers";

const storageKey = <Name extends string>(name: Name) =>
  `${config.appPrefix}@1//${name}` as const;

export const widgetStorageKeys = {
  skPubKeys: storageKey("skPubKeys"),
  tosAccepted: storageKey("tosAccepted"),
} as const;

export const StoredPublicKeys = Schema.Record(Schema.String, Schema.String);
export type StoredPublicKeys = typeof StoredPublicKeys.Type;

export const TosAccepted = Schema.Boolean;
export type TosAccepted = typeof TosAccepted.Type;

export const widgetStorageDefaults: {
  readonly skPubKeys: StoredPublicKeys;
  readonly tosAccepted: TosAccepted;
} = {
  skPubKeys: {},
  tosAccepted: false,
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
      const tosStore = KeyValueStore.toSchemaStore(store, TosAccepted);
      const readStoredPublicKeys = publicKeysStore
        .get(widgetStorageKeys.skPubKeys)
        .pipe(
          Effect.map(Option.getOrElse(() => widgetStorageDefaults.skPubKeys))
        );

      return {
        getTosAccepted: tosStore
          .get(widgetStorageKeys.tosAccepted)
          .pipe(
            Effect.map(
              Option.getOrElse(() => widgetStorageDefaults.tosAccepted)
            )
          ),
        readStoredPublicKeys,
        setTosAccepted: (value: TosAccepted) =>
          tosStore.set(widgetStorageKeys.tosAccepted, value),
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

export const readStoredPublicKeys = WidgetPersistence.use(
  (persistence) => persistence.readStoredPublicKeys
);
