import { type Duration, Effect, type Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { InputValidationError } from "../domain/schema/api-errors";

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

export const withInputValidationError = (operation: string) =>
  function mapInputValidationError<A, R>(
    effect: Effect.Effect<A, Schema.SchemaError, R>
  ) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new InputValidationError({
            operation,
            issue: cause.message,
            cause,
          })
      )
    );
  };

interface AtomRefreshTarget {
  readonly refresh: <A>(atom: Atom.Atom<A>) => void;
}

export const refreshAtomResources = (
  target: AtomRefreshTarget,
  resources: ReadonlyArray<Atom.Atom<unknown>>
) => {
  for (const resource of resources) target.refresh(resource);
};
