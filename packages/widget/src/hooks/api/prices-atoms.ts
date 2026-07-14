import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import { config } from "../../config";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { PriceRequest } from "../../domain/schema/health-price-models";
import type { AppToken } from "../../domain/schema/legacy-models";
import { StakeKitApiService } from "../../providers/api/api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";

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
        currency: config.currency,
        tokenList: [token, token, yieldDto.mechanics.gasFeeToken],
      }
    : null;

export const pricesAtom = Atom.family((key: PricesKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.request) return null;

        const api = yield* StakeKitApiService;
        return yield* api.legacy.getPrices(key.request);
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
