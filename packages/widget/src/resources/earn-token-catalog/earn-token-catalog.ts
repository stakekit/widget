import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { YieldCategory } from "../../domain/earn/contract";
import {
  getApiYieldTypesForYieldCategory,
  getDisplayOnlyYieldTypes,
  withDisplayOnlyYields,
} from "../../domain/earn/yield";
import type { Network } from "../../domain/network/network";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { LegacyResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class EarnTokenCatalogKey extends Data.TaggedClass(
  "EarnTokenCatalogKey"
)<{
  readonly network: Network | null;
  readonly category: YieldCategory | null;
}> {}

class EarnTokenCatalogError extends Data.TaggedError("EarnTokenCatalogError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const earnTokenCatalogPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

const earnTokenCatalogCanonicalAtom = Atom.family((key: EarnTokenCatalogKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* LegacyResourceSource;
        const scope = {
          ...(key.network === null ? {} : { network: key.network }),
          ...(key.category === null
            ? {}
            : { yieldTypes: getApiYieldTypesForYieldCategory(key.category) }),
        };
        const displayOnlyYieldTypes = getDisplayOnlyYieldTypes(scope);
        // The display-only request is supplemental: its failure must not hide
        // the enterable yields, so it degrades to no display-only yields.
        const offered =
          displayOnlyYieldTypes.length === 0
            ? Effect.succeed([])
            : source
                .getTokenOptions({
                  ...scope,
                  yieldTypes: displayOnlyYieldTypes,
                })
                .pipe(
                  Effect.catch((cause) =>
                    Effect.logWarning("Display-only yields unavailable").pipe(
                      Effect.annotateLogs({
                        cause,
                        event: "earn_display_only_yields_degraded",
                      }),
                      Effect.as([])
                    )
                  )
                );
        const [enterableTokens, offeredTokens] = yield* Effect.all(
          [
            source
              .getTokenOptions({ enter: true, ...scope })
              .pipe(
                Effect.mapError((cause) => new EarnTokenCatalogError({ cause }))
              ),
            offered,
          ],
          { concurrency: "unbounded" }
        );
        return withDisplayOnlyYields(enterableTokens, offeredTokens);
      })
    )
    .pipe(
      earnTokenCatalogPolicy,
      Atom.withLabel("earnTokenCatalogResourceAtom")
    )
);

export const earnTokenCatalogResourceAtom = makePresentableResourceFamily(
  earnTokenCatalogCanonicalAtom
);
