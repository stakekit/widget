import { Layer, Schema } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  acknowledgeTosAtom,
  tosAcknowledgementAtom,
} from "../../src/features/preferences/state/tos-atoms";
import {
  StoredPublicKeys,
  TosAcknowledged,
  WidgetPersistence,
  widgetStorageKeys,
} from "../../src/services/persistence/widget-persistence";

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  reads = 0;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const makeRegistry = (storage: Storage) =>
  AtomRegistry.make({
    initialValues: [
      [
        appRuntime.layer,
        Layer.effect(WidgetPersistence, WidgetPersistence.make).pipe(
          Layer.provide(KeyValueStore.layerStorage(() => storage))
        ),
      ],
    ],
  });

describe("Effect browser persistence", () => {
  it("preserves versioned keys and validates stored value schemas", () => {
    expect(widgetStorageKeys).toEqual({
      skPubKeys: "sk-widget@1//skPubKeys",
      tosAccepted: "sk-widget@1//tosAccepted",
    });
    expect(Schema.decodeSync(TosAcknowledged)(true)).toBe(true);
    expect(
      Schema.decodeSync(StoredPublicKeys)({ cosmos: "public-key" })
    ).toEqual({ cosmos: "public-key" });
    expect(() => Schema.decodeUnknownSync(TosAcknowledged)("true")).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(StoredPublicKeys)({ cosmos: 1 })
    ).toThrow();
  });

  it("reads existing values once and shares them through the atom registry", () => {
    const storage = new MemoryStorage();
    storage.values.set(widgetStorageKeys.tosAccepted, "true");
    storage.values.set(
      widgetStorageKeys.skPubKeys,
      JSON.stringify({ cosmos: "public-key" })
    );
    const registry = makeRegistry(storage);

    expect(
      AsyncResult.getOrThrow(registry.get(tosAcknowledgementAtom))
    ).toEqual({ _tag: "Available", acknowledged: true });
    expect(
      AsyncResult.getOrThrow(registry.get(tosAcknowledgementAtom))
    ).toEqual({ _tag: "Available", acknowledged: true });
    expect(storage.reads).toBe(1);
  });

  it("uses declared defaults when persisted values are absent", () => {
    const registry = makeRegistry(new MemoryStorage());

    expect(
      AsyncResult.getOrThrow(registry.get(tosAcknowledgementAtom))
    ).toEqual({ _tag: "Available", acknowledged: false });
  });

  it("exposes malformed persisted values as schema failures", () => {
    const storage = new MemoryStorage();
    storage.values.set(widgetStorageKeys.tosAccepted, '"not-a-boolean"');
    const registry = makeRegistry(storage);
    const result = registry.get(tosAcknowledgementAtom);

    expect(AsyncResult.getOrThrow(result)).toMatchObject({
      _tag: "Failed",
      error: { _tag: "TosAcknowledgementPersistenceError", operation: "read" },
    });
  });

  it("publishes writes and exposes write failures through mutation state", () => {
    const storage = new MemoryStorage();
    const registry = makeRegistry(storage);

    registry.set(acknowledgeTosAtom, undefined);

    expect(
      AsyncResult.getOrThrow(registry.get(acknowledgeTosAtom))
    ).toBeUndefined();
    expect(
      AsyncResult.getOrThrow(registry.get(tosAcknowledgementAtom))
    ).toEqual({ _tag: "Available", acknowledged: true });
    expect(storage.values.get(widgetStorageKeys.tosAccepted)).toBe("true");

    const failingStorage = new MemoryStorage();
    failingStorage.setItem = () => {
      throw new Error("storage blocked");
    };
    const failingRegistry = makeRegistry(failingStorage);
    failingRegistry.set(acknowledgeTosAtom, undefined);

    expect(AsyncResult.isFailure(failingRegistry.get(acknowledgeTosAtom))).toBe(
      true
    );
  });
});
