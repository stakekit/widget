import { Data, Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  type MissingBorrowApiConfig,
  StakeKitApiService,
} from "../api/api-client";

export { StakeKitApiService };

export class MissingStakeKitApiClient extends Data.TaggedError(
  "MissingStakeKitApiClient"
)<{
  readonly message: string;
}> {}

const missingStakeKitApiLayer = Layer.effect(
  StakeKitApiService,
  Effect.fail(
    new MissingStakeKitApiClient({
      message: "StakeKit API layer was not initialized in the atom runtime.",
    })
  )
);

type StakeKitApiLayerError = MissingBorrowApiConfig | MissingStakeKitApiClient;

export const stakeKitApiLayerAtom = Atom.make<
  Layer.Layer<StakeKitApiService, StakeKitApiLayerError>
>(missingStakeKitApiLayer).pipe(Atom.withLabel("stakeKitApiLayerAtom"));

export const stakeKitApiRuntime = Atom.runtime((get) =>
  get(stakeKitApiLayerAtom)
);
