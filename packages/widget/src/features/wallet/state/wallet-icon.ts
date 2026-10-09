import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

export type WalletIconSource = string | (() => Promise<string>);

/**
 * Resolves wallet and chain icons, which hosts may supply as lazy loaders. A
 * loader that fails leaves the icon unresolved so the fallback renders.
 */
export const walletIconUrlAtom = Atom.family(
  (source: WalletIconSource | null | undefined) =>
    Atom.make(
      typeof source === "function"
        ? Effect.tryPromise(source).pipe(Effect.orElseSucceed(() => undefined))
        : Effect.succeed(source ?? undefined)
    )
);
