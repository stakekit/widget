import { Effect } from "effect";

// oxlint-disable-next-line effect/no-run-effect-in-test -- connector factories require a Promise runner callback
export const runWalletEffect = Effect.runPromise;
