import * as Atom from "effect/unstable/reactivity/Atom";
import { activityTabResourcesPrefetchAtom } from "../../../features/activity/index";
import { borrowLandingPrimaryReadyAtom } from "../../../features/borrow/index";
import { earnLandingPrimaryReadyAtom } from "../../../features/earn/index";
import { manageTabResourcesPrefetchAtom } from "../../../features/portfolio/index";
import { walletScopeAtom } from "../../../features/wallet/index";
import {
  shouldWarmTabResources,
  type TabResourcesPrefetchLandingTab,
} from "../model/tab-resources-prefetch-gate";

export const tabResourcesPrefetchAtom = Atom.family(
  (tab: TabResourcesPrefetchLandingTab) =>
    Atom.make((get) => {
      if (
        !shouldWarmTabResources({
          borrowMarketsReady:
            tab !== "borrow" || get(borrowLandingPrimaryReadyAtom),
          earnTokensReady: tab !== "earn" || get(earnLandingPrimaryReadyAtom),
          hasScope: get(walletScopeAtom) !== null,
          tab,
        })
      ) {
        return "idle" as const;
      }

      get(manageTabResourcesPrefetchAtom);
      get(activityTabResourcesPrefetchAtom);
      return "warming" as const;
    }).pipe(Atom.withLabel(`tabResourcesPrefetchAtom(${tab})`))
);
