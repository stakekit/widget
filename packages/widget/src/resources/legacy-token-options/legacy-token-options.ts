import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { Network } from "../../domain/schema/network-model";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";

class LegacyTokenOptionsError extends Data.TaggedError(
  "LegacyTokenOptionsError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const legacyTokenOptionsPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
});

export const legacyTokenOptionsResourceAtom = Atom.family(
  (network: Network | null) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const source = yield* LegacyResourceSource;
          return yield* source
            .getTokenOptions(network ?? undefined)
            .pipe(
              Effect.mapError((cause) => new LegacyTokenOptionsError({ cause }))
            );
        })
      )
      .pipe(
        legacyTokenOptionsPolicy,
        Atom.withLabel("legacyTokenOptionsResourceAtom")
      )
);
