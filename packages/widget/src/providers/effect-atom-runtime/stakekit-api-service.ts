import { Context, Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EffectApiClient } from "../api/api-client";

export class MissingStakeKitApiClient extends Data.TaggedError(
  "MissingStakeKitApiClient"
)<{
  readonly message: string;
}> {}

export class StakeKitApiService extends Context.Service<
  StakeKitApiService,
  EffectApiClient
>()("stakekit/widget/StakeKitApiService") {}

export const stakeKitEffectApiClientAtom = Atom.make<EffectApiClient | null>(
  null
).pipe(Atom.withLabel("stakeKitEffectApiClientAtom"));
