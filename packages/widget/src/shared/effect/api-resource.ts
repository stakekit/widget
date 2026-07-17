import type { Duration } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

type ApiResourcePolicy = {
  readonly focusSignal?: Atom.Atom<unknown>;
  readonly idleTTL: Duration.Input;
  readonly revalidateOnFocus?: boolean | "always";
  readonly revalidateOnMount?: boolean;
  readonly staleTime: Duration.Input;
};

export const withApiResourcePolicy = (policy: ApiResourcePolicy) =>
  function applyApiResourcePolicy<
    A,
    E,
    Resource extends Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  >(resource: Resource) {
    return resource.pipe(
      Atom.swr({
        staleTime: policy.staleTime,
        focusSignal: policy.focusSignal,
        revalidateOnMount: policy.revalidateOnMount,
        revalidateOnFocus: policy.revalidateOnFocus,
      }),
      Atom.setIdleTTL(policy.idleTTL)
    );
  };
