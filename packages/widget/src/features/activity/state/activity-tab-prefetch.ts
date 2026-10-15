import * as Atom from "effect/reactivity/Atom";
import { walletScopeAtom } from "../../wallet/index";
import { widgetConfigAtom } from "../../widget-configuration/index";
import { ActivityActionsKey, activityActionsPullAtom } from "./page-resources";

/**
 * Keeps the Activity "All" feed (plus enrichment) subscribed while mounted so
 * navigating to Activity can paint from cache. Filter chips wait until Activity.
 */
export const activityTabResourcesPrefetchAtom = Atom.make((get) => {
  const scope = get(walletScopeAtom);
  const { borrowEnabled } = get(widgetConfigAtom);
  get(
    activityActionsPullAtom(
      new ActivityActionsKey({ borrowEnabled, filter: "all", scope })
    )
  );
}).pipe(Atom.withLabel("activityTabResourcesPrefetchAtom"));
