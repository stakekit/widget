import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import { EarnPositionsResponse } from "../../domain/schema/earn-models";
import type { YieldBalancesCommand } from "../../domain/schema/financial-models";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

export class YieldBalancesKey extends Data.Class<{
  readonly command: YieldBalancesCommand | null;
  readonly enabled: boolean;
}> {}

export const yieldBalancesAtom = valueEqualAtomFamily((key: YieldBalancesKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.command) return null;

        const api = yield* StakeKitApiService;
        const response = yield* api.yield
          .YieldsControllerGetAggregateBalances({ payload: key.command })
          .pipe(withApiRequestError("yield-balances"));

        return yield* Schema.decodeUnknownEffect(EarnPositionsResponse)(
          response
        ).pipe(withResponseDecodeError("yield-balances"));
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.minutes(1),
        revalidateOnMount: true,
      })
    )
);
