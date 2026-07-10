import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import {
  type TokenBalanceScanCommand,
  TokenBalancesResponse,
} from "../../domain/schema/financial-models";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

export class TokenBalancesKey extends Data.Class<{
  readonly command: TokenBalanceScanCommand | null;
  readonly enabled: boolean;
}> {}

export const tokenBalancesAtom = valueEqualAtomFamily((key: TokenBalancesKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.command) return null;

        const api = yield* StakeKitApiService;
        const response = yield* api.legacy
          .TokenControllerTokenBalancesScan({ payload: key.command })
          .pipe(withApiRequestError("token-balances-scan"));

        return yield* Schema.decodeUnknownEffect(TokenBalancesResponse)(
          response
        ).pipe(withResponseDecodeError("token-balances-scan"));
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
