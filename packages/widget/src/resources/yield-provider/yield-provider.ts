import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { ProviderId } from "../../domain/schema/identifiers";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class YieldProviderError extends Data.TaggedError("YieldProviderError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
  readonly providerId: ProviderId;
}> {}

const providerPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(10),
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
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
