import { Data, Duration, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { YieldId } from "../../domain/schema/identifiers";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { yieldProviderResourceAtom } from "../yield-provider/yield-provider";

export class YieldOpportunityError extends Data.TaggedError(
  "YieldOpportunityError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const opportunityPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(10),
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
});

export const yieldOpportunityResourceAtom = Atom.family((yieldId: YieldId) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* YieldResourceSource;
        return yield* source
          .getOpportunity(yieldId)
          .pipe(
            Effect.mapError((cause) => new YieldOpportunityError({ cause }))
          );
      })
    )
    .pipe(opportunityPolicy, Atom.withLabel("yieldOpportunityResourceAtom"))
);

export const enrichedYieldOpportunityResourceAtom = Atom.family(
  (yieldId: YieldId) =>
    appRuntime.atom((get) =>
      Effect.gen(function* () {
        const yieldModel = yield* get.result(
          yieldOpportunityResourceAtom(yieldId)
        );
        const provider = yield* get
          .result(yieldProviderResourceAtom(yieldModel.providerId))
          .pipe(Effect.map(Option.getOrUndefined));

        return {
          ...yieldModel,
          ...(provider ? { provider } : {}),
        } satisfies EarnYieldWithProvider;
      })
    )
);
