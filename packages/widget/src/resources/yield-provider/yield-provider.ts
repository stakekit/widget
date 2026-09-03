import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { ProviderId } from "../../domain/identity/identifiers";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class YieldProviderError extends Data.TaggedError("YieldProviderError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
  readonly providerId: ProviderId;
}> {}

const providerPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

const yieldProviderCanonicalAtom = Atom.family((providerId: ProviderId) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* YieldResourceSource;
        return yield* source
          .getProvider(providerId)
          .pipe(
            Effect.mapError(
              (cause) => new YieldProviderError({ cause, providerId })
            )
          );
      })
    )
    .pipe(providerPolicy, Atom.withLabel("yieldProviderResourceAtom"))
);

export const yieldProviderResourceAtom = makePresentableResourceFamily(
  yieldProviderCanonicalAtom
);
