import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

export type WalletIconSource = string | (() => Promise<string>);

/**
 * Resolves wallet and chain icons, which hosts may supply as lazy loaders. The
 * URL is `undefined` while a loader runs or after it fails, so the fallback
 * renders.
 */
export const walletIconUrlAtom = Atom.family(
  (source: WalletIconSource | null | undefined) =>
    Atom.make(
      typeof source === "function"
        ? Effect.tryPromise(source).pipe(Effect.orElseSucceed(() => undefined))
        : Effect.succeed(source ?? undefined)
    ).pipe(Atom.map(AsyncResult.getOrElse(() => undefined)))
);
