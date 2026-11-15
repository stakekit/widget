import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { EarnProvider } from "../../domain/earn/provider";
import type { ProviderId } from "../../domain/identity/identifiers";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPages,
} from "../../shared/effect/pagination";
import { makePresentableResource } from "../resource-failure-presentation";

export class YieldProviderError extends Data.TaggedError("YieldProviderError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const providersPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

const yieldProvidersCanonicalAtom = appRuntime
  .atom(() =>
    YieldResourceSource.use((source) =>
      loadAllPages({
        concurrency: 5,
        fetchPage: (offset) =>
          source.listProviders({ limit: API_MAX_PAGE_SIZE, offset }),
        pageSize: API_MAX_PAGE_SIZE,
      })
    ).pipe(
      Effect.mapBoth({
        onFailure: (cause) => new YieldProviderError({ cause }),
        onSuccess: (providers): ReadonlyMap<ProviderId, EarnProvider> =>
          new Map(providers.map((provider) => [provider.id, provider])),
      })
    )
  )
  .pipe(providersPolicy, Atom.withLabel("yieldProvidersResourceAtom"));

/** Every Yield Provider by id, in one read that serves every Yield. */
export const yieldProvidersResourceAtom = makePresentableResource(
  yieldProvidersCanonicalAtom
);

/**
 * One Yield Provider from the provider list: absent when the list lacks it,
 * failed when the list failed.
 */
export const yieldProviderAtom = Atom.family((providerId: ProviderId) =>
  Atom.make((get) =>
    get(yieldProvidersResourceAtom.local).pipe(
      AsyncResult.map((providers) =>
        Option.fromNullishOr(providers.get(providerId))
      )
    )
  ).pipe(Atom.withLabel("yieldProviderAtom"))
);
