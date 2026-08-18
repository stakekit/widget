import { Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../app/runtime/app-runtime";
import type { ApiRequestError } from "../services/api/resource-sources";
import { RichErrorService } from "../services/errors/rich-error-service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const findRequestError = (
  value: unknown,
  visited = new Set<unknown>()
): ApiRequestError | null => {
  if (!isRecord(value) || visited.has(value)) return null;
  visited.add(value);

  if (value._tag === "ApiRequestError") {
    return value as unknown as ApiRequestError;
  }

  return "cause" in value ? findRequestError(value.cause, visited) : null;
};

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

export const makePresentableResource = <
  Value,
  Error,
  ResourceAtom extends Atom.Atom<AsyncResult.AsyncResult<Value, Error>>,
>(
  local: ResourceAtom
): PresentableResource<ResourceAtom> => {
  const reporterAtom = appRuntime.atom((get) => {
    const error = get(local).pipe(AsyncResult.error, Option.getOrNull);
    const requestError = findRequestError(error);

    return requestError
      ? RichErrorService.use((service) =>
          service.presentRequestError(requestError)
        )
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
  local: (key: Key) => ResourceAtom
): PresentableResourceFamily<Key, ResourceAtom> => {
  const foreground = Atom.family(
    (key: Key) => makePresentableResource(local(key)).foreground
  );

  return Object.assign(foreground, { foreground, local });
};
