import { type Duration, Effect, type Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  ApiRequestError,
  ResponseDecodeError,
} from "../domain/schema/api-errors";

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

/**
 * Atom.family uses Effect Hash/Equal semantics. Public callers should pass
 * primitive keys, Schema classes, or Data classes so equivalent key values
 * resolve to the same atom instance.
 */
export const valueEqualAtomFamily = <Key, Resource extends object>(
  make: (key: Key) => Resource
) => Atom.family(make);

export const withApiRequestError = (operation: string) =>
  function mapApiRequestError<A, E, R>(effect: Effect.Effect<A, E, R>) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ApiRequestError({
            operation,
            cause,
          })
      )
    );
  };

export const withResponseDecodeError = (operation: string) =>
  function mapResponseDecodeError<A, R>(
    effect: Effect.Effect<A, Schema.SchemaError, R>
  ) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ResponseDecodeError({
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

// Effect Atom invalidation is an explicit refresh of the affected resource.
export const invalidateAtomResources = refreshAtomResources;
