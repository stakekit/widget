import { Context, Effect, Layer, Queue, Stream } from "effect";

/** The color scheme the operating system prefers. */
export type PreferredColorScheme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

const schemeOf = (prefersDark: boolean): PreferredColorScheme =>
  prefersDark ? "dark" : "light";

/**
 * The preference now, then each change. Without `matchMedia`, as outside a
 * browser, it is light.
 */
const preferenceStream: Stream.Stream<PreferredColorScheme> =
  Stream.callback<PreferredColorScheme>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (typeof globalThis.matchMedia !== "function") {
            Queue.offerUnsafe(queue, "light");
            return undefined;
          }
          const query = globalThis.matchMedia(darkQuery);
          const publish = (event: MediaQueryListEvent) => {
            Queue.offerUnsafe(queue, schemeOf(event.matches));
          };
          query.addEventListener("change", publish);
          Queue.offerUnsafe(queue, schemeOf(query.matches));
          return () => query.removeEventListener("change", publish);
        }),
        (unsubscribe) =>
          Effect.sync(() => {
            unsubscribe?.();
          })
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

/** Observes the operating system's color scheme preference. */
export class ColorSchemePreference extends Context.Service<
  ColorSchemePreference,
  { readonly changes: Stream.Stream<PreferredColorScheme> }
>()("stakekit/widget/services/ColorSchemePreference") {
  static readonly layer = Layer.succeed(
    ColorSchemePreference,
    ColorSchemePreference.of({ changes: preferenceStream })
  );
}
