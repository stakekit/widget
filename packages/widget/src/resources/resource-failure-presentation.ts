import { Cause, Effect, Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../app/runtime/app-runtime";
import type { BorrowFeatureDisabled } from "../domain/borrow/availability";
import type {
  ApiRequestError,
  InputValidationError,
  MissingBorrowApiConfig,
  ResponseDecodeError,
} from "../services/api/resource-sources";
import { RichErrorService } from "../services/errors/rich-error-service";
import { toPresentable } from "../shared/effect/async-result";

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

/** A resource failure: absence, or a resource error over a typed cause. */
type PresentableResourceError =
  | Cause.NoSuchElementError
  | { readonly _tag: string; readonly cause: ResourceCause };

const requestErrorFrom = (
  error: PresentableResourceError
): ApiRequestError | null => {
  if (Cause.isNoSuchElementError(error)) return null;

  return error.cause._tag === "ApiRequestError" ? error.cause : null;
};

export const makePresentableResource = <
  Value,
  Error extends PresentableResourceError,
  ResourceAtom extends Atom.Atom<AsyncResult.AsyncResult<Value, Error>>,
>(
  local: PresentableAtom<ResourceAtom>
): PresentableResource<ResourceAtom> => {
  // A failed refetch over a value is background state; only a failure with
  // nothing to show interrupts the user.
  const reporterAtom = appRuntime.atom((get) => {
    const presentable = toPresentable(get(local));
    const requestError =
      presentable._tag === "Failed"
        ? Cause.findErrorOption(presentable.cause).pipe(
            Option.map(requestErrorFrom),
            Option.getOrNull
          )
        : null;

    return requestError
      ? RichErrorService.use((service) => service.present(requestError))
      : Effect.void;
  });

  const transformed = Atom.transform(local, (get) => {
    get.mount(reporterAtom);
    return get(local);
  });
  const foreground: Atom.WithoutSerializable<ResourceAtom> =
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: Atom.transform's return is a conditional type over the generic ResourceAtom that TypeScript cannot relate to Atom.WithoutSerializable<ResourceAtom>.
    transformed as unknown as Atom.WithoutSerializable<ResourceAtom>;

  return Object.assign(foreground, { foreground, local });
};

export const makePresentableResourceFamily = <
  Key,
  Value,
  Error extends PresentableResourceError,
  ResourceAtom extends Atom.Atom<AsyncResult.AsyncResult<Value, Error>>,
>(
  local: (key: Key) => PresentableAtom<ResourceAtom>
): PresentableResourceFamily<Key, ResourceAtom> => {
  const foreground = Atom.family(
    (key: Key) => makePresentableResource(local(key)).foreground
  );

  return Object.assign(foreground, { foreground, local });
};
