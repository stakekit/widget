import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import {
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../atoms/api-resource";
import { HealthStatus } from "../domain/schema/health-price-models";
import { StakeKitApiService } from "../providers/api/api-client";
import { stakeKitApiRuntime } from "../providers/effect-atom-runtime/stakekit-api-service";

const healthStatusAtom = stakeKitApiRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* StakeKitApiService;
      const response = yield* api.yield
        .HealthControllerHealth(undefined)
        .pipe(withApiRequestError("yield-api-health"));

      return yield* Schema.decodeUnknownEffect(HealthStatus)(response).pipe(
        withResponseDecodeError("yield-api-health")
      );
    })
  )
  .pipe(
    withApiResourcePolicy({
      idleTTL: Duration.minutes(5),
      staleTime: Duration.seconds(30),
      revalidateOnMount: true,
    })
  );

export const useUnderMaintenance = () => {
  const result = useAtomValue(healthStatusAtom);
  const refresh = useAtomRefresh(healthStatusAtom);

  useEffect(() => {
    const interval = globalThis.setInterval(refresh, 30_000);
    return () => globalThis.clearInterval(interval);
  }, [refresh]);

  const health = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return (
    AsyncResult.isFailure(result) ||
    (health !== undefined && health.status !== "OK")
  );
};
