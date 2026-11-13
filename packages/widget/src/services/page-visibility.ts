import { Context, Effect, Layer, Queue, Stream } from "effect";

/** Whether the host page is shown to the user. */
export type PageVisibilityState = "visible" | "hidden";

/**
 * The visibility now, then each change. Without a document, as outside a
 * browser, the page is visible.
 */
const visibilityStream: Stream.Stream<PageVisibilityState> =
  Stream.callback<PageVisibilityState>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (typeof globalThis.document === "undefined") {
            Queue.offerUnsafe(queue, "visible");
            return undefined;
          }
          const document = globalThis.document;
          const publish = () => {
            Queue.offerUnsafe(
              queue,
              document.visibilityState === "hidden" ? "hidden" : "visible"
            );
          };
          document.addEventListener("visibilitychange", publish);
          publish();
          return () =>
            document.removeEventListener("visibilitychange", publish);
        }),
        (unsubscribe) =>
          Effect.sync(() => {
            unsubscribe?.();
          })
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

/** Observes whether the host page is visible. */
export class PageVisibility extends Context.Service<
  PageVisibility,
  { readonly changes: Stream.Stream<PageVisibilityState> }
>()("@stakekit/widget/services/page-visibility/PageVisibility") {
  static readonly layer = Layer.succeed(
    PageVisibility,
    PageVisibility.of({ changes: visibilityStream })
  );
}
