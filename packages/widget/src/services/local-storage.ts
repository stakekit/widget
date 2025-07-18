import type { GetType } from "purify-ts";
import { boolean, Either, Right, record, string } from "purify-ts";
import { config } from "../config";
import { MaybeWindow } from "../utils/maybe-window";

const localStorageBuildKey = <K extends string>(key: K) =>
  `${config.appPrefix}@1//${key}` as const;

const codecs = {
  [localStorageBuildKey("skPubKeys")]: record(string, string),
  [localStorageBuildKey("shimDisconnect/tron")]: boolean,
  [localStorageBuildKey("tosAccepted")]: boolean,
};

export type LocalStorageKV = {
  [Key in keyof typeof codecs]: GetType<(typeof codecs)[Key]>;
};

type LocalStorageValue<K extends keyof LocalStorageKV> = GetType<
  (typeof codecs)[K]
>;

export const getStorageItem = <K extends keyof LocalStorageKV>(
  key: K
): Either<Error, LocalStorageValue<K> | null> => {
  const w = MaybeWindow.extractNullable();

  if (!w) return Right(null);

  const val = w.localStorage.getItem(key);

  if (!val) return Right(null);

  return Either.encase(() => JSON.parse(val) as Record<string, unknown>)
    .chainLeft(() => Right(val))
    .chain((parsedVal) =>
      codecs[key]
        .decode(parsedVal)
        .map((val) => val as LocalStorageValue<K>)
        .mapLeft((e) => new Error(e))
    );
};

export const setStorageItem = <K extends keyof LocalStorageKV>(
  key: K,
  value: GetType<(typeof codecs)[K]>
) => {
  const w = MaybeWindow.extractNullable();

  return Either.encase(() =>
    w?.localStorage.setItem(key, JSON.stringify(value))
  ).ifRight(() => notify(key));
};

type Listener<K extends keyof LocalStorageKV = keyof LocalStorageKV> = (
  val: GetType<(typeof codecs)[K]>
) => void;

const listeners: { [Key in keyof LocalStorageKV]: Map<Listener, Listener> } = {
  [localStorageBuildKey("skPubKeys")]: new Map(),
  [localStorageBuildKey("shimDisconnect/tron")]: new Map(),
  [localStorageBuildKey("tosAccepted")]: new Map(),
};

export const addLocalStorageListener = <K extends keyof LocalStorageKV>(
  key: K,
  listener: Listener<K>
) => {
  listeners[key].set(listener, listener);

  return () => listeners[key].delete(listener);
};

const notify = (key: keyof LocalStorageKV) => {
  getStorageItem(key).ifRight((val) =>
    listeners[key].forEach((listener) => {
      listener(val as GetType<(typeof codecs)[typeof key]>);
    })
  );
};
