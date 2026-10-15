import { Duration } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

type ApiResourcePolicy = {
  readonly staleTime: Duration.Input;
};

const apiResourceIdleTTL = Duration.minutes(5);

export const withApiResourcePolicy = (policy: ApiResourcePolicy) =>
  function applyApiResourcePolicy<
    A,
    E,
    Resource extends Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  >(resource: Resource) {
    return resource.pipe(
      Atom.swr({
        staleTime: policy.staleTime,
        revalidateOnMount: true,
      }),
      Atom.setIdleTTL(apiResourceIdleTTL)
    );
  };
