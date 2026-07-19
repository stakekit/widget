import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { PriceRequest } from "../../../domain/schema/health-price-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";

const DEFAULT_CURRENCY = "USD";

export class PricesKey extends Data.Class<{
  readonly request: PriceRequest | null;
}> {}

export const getTokensPricesRequest = ({
  token,
  yieldDto,
}: {
  readonly token: AppToken | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): PriceRequest | null =>
  token && yieldDto
    ? {
        currency: DEFAULT_CURRENCY,
        tokenList: [token, token, yieldDto.mechanics.gasFeeToken],
      }
    : null;

export const pricesAtom = Atom.family((key: PricesKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.request) return null;

        const api = yield* LegacyApiService;
        return yield* api.getPrices(key.request);
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.minutes(2),
        revalidateOnMount: true,
      })
    )
);
