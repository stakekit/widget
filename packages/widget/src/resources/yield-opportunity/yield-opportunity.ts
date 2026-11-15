import { Data, Duration, Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { EarnYieldWithProvider } from "../../domain/earn/yield-schema";
import type { YieldId } from "../../domain/identity/identifiers";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { liveCampaignRateAtom } from "../project-campaigns/project-campaigns";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import { yieldProviderAtom } from "../yield-provider/yield-provider";

class YieldOpportunityError extends Data.TaggedError("YieldOpportunityError")<{
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
      // Provider details are optional enrichment; a failed lookup must not
      // take the opportunity down with it.
      const provider = yield* get
        .result(yieldProviderAtom(yieldModel.providerId))
        .pipe(
          Effect.map(Option.getOrUndefined),
          Effect.orElseSucceed(() => undefined)
        );

      return get(liveCampaignRateAtom)({
        ...yieldModel,
        ...(provider ? { provider } : {}),
      } satisfies EarnYieldWithProvider);
    })
  )
);

export const enrichedYieldOpportunityResourceAtom =
  makePresentableResourceFamily(enrichedYieldOpportunityCanonicalAtom);
