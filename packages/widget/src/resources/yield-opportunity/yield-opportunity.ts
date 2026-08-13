import { Data, Duration, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { EarnYieldWithProvider } from "../../domain/earn/models";
import type { YieldId } from "../../domain/identity/identifiers";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/api-errors";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import { yieldProviderResourceAtom } from "../yield-provider/yield-provider";

export class YieldOpportunityError extends Data.TaggedError(
  "YieldOpportunityError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const opportunityPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

const yieldOpportunityCanonicalAtom = Atom.family((yieldId: YieldId) =>
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

export const yieldOpportunityResourceAtom = makePresentableResourceFamily(
  yieldOpportunityCanonicalAtom
);

const enrichedYieldOpportunityCanonicalAtom = Atom.family((yieldId: YieldId) =>
  appRuntime.atom((get) =>
    Effect.gen(function* () {
      const yieldModel = yield* get.result(
        yieldOpportunityResourceAtom.local(yieldId)
      );
      const provider = yield* get
        .result(yieldProviderResourceAtom.local(yieldModel.providerId))
        .pipe(Effect.map(Option.getOrUndefined));

      return {
        ...yieldModel,
        ...(provider ? { provider } : {}),
      } satisfies EarnYieldWithProvider;
    })
  )
);

export const enrichedYieldOpportunityResourceAtom =
  makePresentableResourceFamily(enrichedYieldOpportunityCanonicalAtom);
