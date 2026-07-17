import { Duration, Effect, Schedule } from "effect";
import { appRuntime } from "../../../app/runtime";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";

const persistentResource = withApiResourcePolicy({
  idleTTL: Duration.infinity,
  staleTime: Duration.infinity,
  revalidateOnMount: false,
});

const enabledNetworksRetrySchedule = Schedule.exponential(
  Duration.millis(100)
).pipe(
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(5)))
  )
);

export const enabledNetworksAtom = appRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* LegacyApiService;
      return yield* api
        .getEnabledNetworks()
        .pipe(Effect.retry(enabledNetworksRetrySchedule));
    })
  )
  .pipe(persistentResource);
