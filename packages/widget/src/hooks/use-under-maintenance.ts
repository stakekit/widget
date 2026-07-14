import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import { withApiResourcePolicy } from "../atoms/api-resource";
import { StakeKitApiService } from "../providers/api/api-service";
import { widgetAtomRuntime } from "../providers/effect-atom-runtime/widget-runtime";

const healthStatusAtom = widgetAtomRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* StakeKitApiService;
      return yield* api.yield.getHealth();
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
