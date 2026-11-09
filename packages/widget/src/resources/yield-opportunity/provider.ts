import { Data, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { YieldId } from "../../domain/identity/identifiers";
import { appRuntime } from "../../runtime/app-runtime";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import { enrichedYieldOpportunityResourceAtom } from "./yield-opportunity";

export class YieldOpportunityKey extends Data.Class<{
  readonly yieldId: YieldId | null;
}> {}

const yieldOpportunityCanonicalAtom = Atom.family((key: YieldOpportunityKey) =>
  appRuntime.atom((get) =>
    Effect.gen(function* () {
      if (!key.yieldId) return null;

      return yield* get.result(
        enrichedYieldOpportunityResourceAtom.local(key.yieldId)
      );
    })
  )
);

export const yieldOpportunityAtom = makePresentableResourceFamily(
  yieldOpportunityCanonicalAtom
);
