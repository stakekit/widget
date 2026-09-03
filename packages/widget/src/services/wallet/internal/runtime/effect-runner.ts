import type { Effect } from "effect";

export type RunWalletEffect = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;
