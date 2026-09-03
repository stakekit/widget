import { type Cause, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../app/runtime/app-runtime";
import type { BorrowFeatureDisabled } from "../domain/borrow/availability";
import {
  ApiRequestError,
  type InputValidationError,
  type MissingBorrowApiConfig,
  type ResponseDecodeError,
} from "../services/api/resource-sources";
import { RichErrorService } from "../services/errors/rich-error-service";

type ResourceCause =
  | ApiRequestError
  | BorrowFeatureDisabled
  | InputValidationError
  | MissingBorrowApiConfig
  | ResponseDecodeError;

type ValidResourceError<Error> =
  Exclude<Error, Cause.NoSuchElementError> extends {
    readonly cause: infer ErrorCause;
  }
    ? [ErrorCause] extends [ResourceCause]
      ? ApiRequestError extends ErrorCause
        ? Error
        : never
      : never
    : never;

type EnforcesPresentableResourceError<Error> = [Error] extends [
  ValidResourceError<Error>,
]
  ? unknown
  : never;

type ErrorOf<ResourceAtom> =
  ResourceAtom extends Atom.Atom<
    AsyncResult.AsyncResult<infer _Value, infer Error>
  >
    ? Error
    : never;

type PresentableAtom<ResourceAtom> = ResourceAtom &
  EnforcesPresentableResourceError<ErrorOf<ResourceAtom>>;

type PresentableResource<ResourceAtom extends Atom.Atom<unknown>> =
  Atom.WithoutSerializable<ResourceAtom> & {
    readonly foreground: Atom.WithoutSerializable<ResourceAtom>;
    readonly local: ResourceAtom;
  };

type PresentableResourceFamily<
  Key,
  ResourceAtom extends Atom.Atom<unknown>,
> = ((key: Key) => Atom.WithoutSerializable<ResourceAtom>) & {
  readonly foreground: (key: Key) => Atom.WithoutSerializable<ResourceAtom>;
  readonly local: (key: Key) => ResourceAtom;
};

const ResourceFailure = Schema.Struct({ cause: Schema.Unknown });

const requestErrorFrom = (error: unknown): ApiRequestError | null => {
  const failure = Schema.decodeUnknownOption(ResourceFailure)(error).pipe(
    Option.getOrNull
  );

  return failure && Schema.is(ApiRequestError)(failure.cause)
    ? failure.cause
    : null;
};

export const makePresentableResource = <
  Value,
  Error,
  ResourceAtom extends Atom.Atom<AsyncResult.AsyncResult<Value, Error>>,
>(
  local: PresentableAtom<ResourceAtom>
): PresentableResource<ResourceAtom> => {
  const reporterAtom = appRuntime.atom((get) => {
    const requestError = requestErrorFrom(
      get(local).pipe(AsyncResult.error, Option.getOrNull)
    );

    return requestError
      ? RichErrorService.use((service) => service.present(requestError))
      : Effect.void;
  });

  const foreground = Atom.transform(local, (get) => {
    get.mount(reporterAtom);
    return get(local);
  }) as unknown as Atom.WithoutSerializable<ResourceAtom>;

  return Object.assign(foreground, { foreground, local });
};

export const makePresentableResourceFamily = <
  Key,
  Value,
  Error,
  ResourceAtom extends Atom.Atom<AsyncResult.AsyncResult<Value, Error>>,
>(
  local: (key: Key) => PresentableAtom<ResourceAtom>
): PresentableResourceFamily<Key, ResourceAtom> => {
  const foreground = Atom.family(
    (key: Key) => makePresentableResource(local(key)).foreground
  );

  return Object.assign(foreground, { foreground, local });
};
