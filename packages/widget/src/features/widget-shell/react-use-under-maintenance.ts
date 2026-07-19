import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import { appRuntime } from "../../app/runtime/app-runtime";
import { YieldApiService } from "../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";

const healthStatusAtom = appRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* YieldApiService;
      return yield* api.getHealth();
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
