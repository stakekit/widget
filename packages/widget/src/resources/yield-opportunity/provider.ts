import { Data, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { YieldId } from "../../domain/schema/identifiers";
import { enrichedYieldOpportunityResourceAtom } from "./yield-opportunity";

export class YieldOpportunityKey extends Data.Class<{
  readonly yieldId: YieldId | null;
}> {}

export const yieldOpportunityAtom = Atom.family((key: YieldOpportunityKey) =>
  appRuntime.atom((get) =>
    Effect.gen(function* () {
      if (!key.yieldId) return null;

      return yield* get.result(
        enrichedYieldOpportunityResourceAtom(key.yieldId)
      );
    })
  )
);
