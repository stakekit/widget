import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { walletConfigResultAtom, walletStateResultAtom } from "./root-atom";

/**
 * A Wallet Runtime failure, typed error or defect. Defects matter most: a
 * Wallet Bootstrap that throws dies, and `AsyncResult.error` ignores it.
 */
const walletRuntimeFailure = <A, E>(result: AsyncResult.AsyncResult<A, E>) =>
  AsyncResult.cause(result).pipe(
    Option.filter((cause) => !Cause.hasInterruptsOnly(cause))
  );

/** The wagmi config once loaded, and the Wallet Runtime failure, if any. */
export const wagmiConfigViewAtom = Atom.make((get) => {
  const walletConfigResult = get(walletConfigResultAtom);
  const walletStateResult = get(walletStateResultAtom);
  return {
    config: walletConfigResult.pipe(AsyncResult.value, Option.getOrUndefined),
    failure: walletRuntimeFailure(walletConfigResult).pipe(
      Option.orElse(() => walletRuntimeFailure(walletStateResult))
    ),
  };
}).pipe(Atom.withLabel("wagmiConfigViewAtom"));
