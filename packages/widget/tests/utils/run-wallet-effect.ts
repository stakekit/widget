import { Effect } from "effect";

// ast-grep-ignore: no-run-effect-in-test -- connector factories require a Promise runner callback
export const runWalletEffect = Effect.runPromise;
