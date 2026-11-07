import { Data, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

export type WalletIconSource = string | (() => Promise<string>);

class WalletIconLoadError extends Data.TaggedError("WalletIconLoadError")<{
  readonly cause: unknown;
}> {}

/**
 * Resolves wallet and chain icons, which hosts may supply as lazy loaders. The
 * URL is `undefined` while a loader runs or after it fails, so the fallback
 * renders.
 */
export const walletIconUrlAtom = Atom.family(
  (source: WalletIconSource | null | undefined) =>
    Atom.make(
      typeof source === "function"
        ? Effect.tryPromise({
            try: source,
            catch: (cause) => new WalletIconLoadError({ cause }),
          }).pipe(Effect.orElseSucceed(() => undefined))
        : Effect.succeed(source ?? undefined)
    ).pipe(Atom.map(AsyncResult.getOrElse(() => undefined)))
);
