import * as Atom from "effect/unstable/reactivity/Atom";
import { walletScopeAtom } from "../../wallet/index";
import { ActivityActionsKey, activityActionsPullAtom } from "./page-resources";

/**
 * Keeps the Activity "All" feed (plus enrichment) subscribed while mounted so
 * navigating to Activity can paint from cache. Filter chips wait until Activity.
 */
export const activityTabResourcesPrefetchAtom = Atom.make((get) => {
  const scope = get(walletScopeAtom);
  get(
    activityActionsPullAtom(new ActivityActionsKey({ filter: "all", scope }))
  );
}).pipe(Atom.withLabel("activityTabResourcesPrefetchAtom"));
