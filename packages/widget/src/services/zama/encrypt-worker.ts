import encryptWorkerUrl from "@zama-fhe/sdk/encrypt.worker.js?worker&url";
import { Effect } from "effect";
import type { HttpClient } from "effect/http";

/**
 * The Zama SDK's `offloadWorker` option. `undefined` leaves the SDK to spawn
 * its own worker and to fall back to the main thread if that fails.
 */
export type EncryptWorkerSource = string | (() => Worker) | undefined;

const javaScriptContentType = /\b(?:java|ecma)script\b/i;

/**
 * Whether the host serves the built encrypt worker script beside the widget.
 * Hosts that re-bundle `dist` copy it from its chunk-relative URL; browsers
 * only start workers from same-origin scripts.
 */
export const isEncryptWorkerServed = Effect.fn("isEncryptWorkerServed")(
  function* (client: HttpClient.HttpClient, url: string, origin: string) {
    if (new URL(url).origin !== origin) return false;
    return yield* client.head(url).pipe(
      Effect.map(
        (response) =>
          response.status >= 200 &&
          response.status < 300 &&
          javaScriptContentType.test(response.headers["content-type"] ?? "")
      ),
      // A host that never answers must not hold up encryption.
      Effect.timeout("5 seconds"),
      Effect.orElseSucceed(() => false)
    );
  }
);

/**
 * Picks the encrypt worker for this page: the host's copy when it serves one,
 * otherwise a copy inlined into a lazy chunk and started from a Blob URL, so
 * ZK proofs do not block the page's main thread. Never fails: a failure here
 * must not fail the SDK load, which the Zama service caches.
 */
export const loadEncryptWorker = Effect.fn("loadEncryptWorker")(function* (
  client: HttpClient.HttpClient
) {
  // Built output yields an absolute URL; the Vite dev server a root-relative one.
  const url = new URL(encryptWorkerUrl, globalThis.location.href).href;
  if (yield* isEncryptWorkerServed(client, url, globalThis.location.origin)) {
    return url satisfies EncryptWorkerSource;
  }
  return yield* Effect.tryPromise(() => import("./encrypt-worker-inline")).pipe(
    Effect.map(
      ({ default: InlineEncryptWorker }): EncryptWorkerSource =>
        () =>
          new InlineEncryptWorker({ name: "zama-fhe-encrypt" })
    ),
    Effect.orElseSucceed((): EncryptWorkerSource => undefined)
  );
});
