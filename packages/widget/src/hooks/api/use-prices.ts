import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option, Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import { ResponseDecodeError } from "../../domain/schema/api-errors";
import {
  PriceRequest,
  PriceResponse,
  type Prices,
} from "../../domain/schema/health-price-models";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

class PriceRequestKey extends Data.Class<{
  readonly decodeIssue: string | null;
  readonly enabled: boolean;
  readonly request: PriceRequest | null;
}> {}

const priceResourcePolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

const pricesAtom = valueEqualAtomFamily((key: PriceRequestKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (key.decodeIssue) {
          return yield* new ResponseDecodeError({
            operation: "token-prices-request",
            issue: key.decodeIssue,
            cause: new Error(key.decodeIssue),
          });
        }

        if (!key.enabled || !key.request) return null;

        const api = yield* StakeKitApiService;
        const response = yield* api.legacy
          .TokenControllerGetTokenPrices({ payload: key.request })
          .pipe(withApiRequestError("token-prices"));

        return yield* Schema.decodeUnknownEffect(PriceResponse)(response).pipe(
          withResponseDecodeError("token-prices")
        );
      })
    )
    .pipe(priceResourcePolicy)
);

type PriceRequestInput = typeof PriceRequest.Encoded;

export const usePrices = <T = Prices>(
  priceRequest: PriceRequestInput | null | undefined,
  opts?: {
    enabled?: boolean;
    select?: (val: Prices) => T;
  }
) => {
  const decodedRequest = priceRequest
    ? Schema.decodeUnknownResult(PriceRequest)(priceRequest)
    : null;
  const request = decodedRequest
    ? Result.getOrElse(decodedRequest, () => null)
    : null;
  const decodeIssue =
    decodedRequest && Result.isFailure(decodedRequest)
      ? decodedRequest.failure.message
      : null;
  const enabled = !!priceRequest && opts?.enabled !== false;
  const resource = pricesAtom(
    new PriceRequestKey({ decodeIssue, enabled, request })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data:
      value === undefined || value === null
        ? undefined
        : opts?.select
          ? opts.select(value)
          : (value as T),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
