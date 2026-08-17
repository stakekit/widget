import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { getApiYieldTypesForDashboardCategory } from "../../domain/earn/yield";
import type { Network } from "../../domain/network/network";
import type { DashboardYieldCategory } from "../../public-api/types";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/api-errors";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
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
        return yield* source
          .getTokenOptions({
            enter: true,
            network: key.network ?? undefined,
            yieldTypes: key.category
              ? getApiYieldTypesForDashboardCategory(key.category)
              : undefined,
          })
          .pipe(
            Effect.mapError((cause) => new EarnTokenCatalogError({ cause }))
          );
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
