import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import {
  getApiYieldTypesForDashboardCategory,
  getDisplayOnlyYieldTypes,
  withDisplayOnlyYields,
} from "../../domain/earn/yield";
import type { Network } from "../../domain/network/network";
import type { DashboardYieldCategory } from "../../public-api/types";
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
  readonly category: DashboardYieldCategory | null;
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
        const network = key.network ?? undefined;
        const yieldTypes = key.category
          ? getApiYieldTypesForDashboardCategory(key.category)
          : undefined;
        const displayOnlyYieldTypes = getDisplayOnlyYieldTypes({
          network,
          yieldTypes,
        });
        const [enterable, offered] = yield* Effect.all(
          [
            source.getTokenOptions({ enter: true, network, yieldTypes }),
            displayOnlyYieldTypes.length === 0
              ? Effect.succeed([])
              : source.getTokenOptions({
                  network,
                  yieldTypes: displayOnlyYieldTypes,
                }),
          ],
          { concurrency: "unbounded" }
        ).pipe(
          Effect.mapError((cause) => new EarnTokenCatalogError({ cause }))
        );
        return withDisplayOnlyYields(enterable, offered);
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
