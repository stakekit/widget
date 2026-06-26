import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  MissingStakeKitApiClient,
  StakeKitApiService,
  stakeKitEffectApiClientAtom,
} from "../../../../../../providers/effect-atom-runtime/stakekit-api-service";
import { EarnCatalogError } from "../types";

export { StakeKitApiService };

export const widgetAtomRuntime = Atom.runtime((get) => {
  const apiClient = get(stakeKitEffectApiClientAtom);

  return apiClient
    ? Layer.succeed(StakeKitApiService, apiClient)
    : Layer.effect(
        StakeKitApiService,
        Effect.fail(
          new EarnCatalogError({
            operation: "runtime",
            cause: new MissingStakeKitApiClient({
              message:
                "StakeKit Effect API client was not initialized in the atom runtime.",
            }),
          })
        )
      );
});
