import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  MissingStakeKitApiClient,
  StakeKitApiService,
  stakeKitApiLayerAtom,
} from "../../../../../../providers/effect-atom-runtime/stakekit-api-service";
import { EarnCatalogError } from "../types";

export { StakeKitApiService };

export const widgetAtomRuntime = Atom.runtime((get) => {
  return get(stakeKitApiLayerAtom).pipe(
    Layer.catch((cause) =>
      Layer.effect(
        StakeKitApiService,
        Effect.fail(
          new EarnCatalogError({
            operation: "runtime",
            cause:
              cause instanceof MissingStakeKitApiClient
                ? cause
                : new MissingStakeKitApiClient({
                    message: "StakeKit API layer failed to initialize.",
                  }),
          })
        )
      )
    )
  );
});
