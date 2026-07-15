import { Duration, Effect } from "effect";
import { appRuntime } from "../../../app/runtime";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";

const persistentResource = withApiResourcePolicy({
  idleTTL: Duration.infinity,
  staleTime: Duration.infinity,
  revalidateOnMount: false,
});

export const enabledNetworksAtom = appRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* LegacyApiService;
      return yield* api.getEnabledNetworks();
    })
  )
  .pipe(persistentResource);
