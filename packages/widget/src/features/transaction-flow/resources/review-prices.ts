import * as Atom from "effect/unstable/reactivity/Atom";
import { getTokensPricesRequest, PricesKey, pricesAtom } from "../../earn";
import { enterStakeRequestAtom } from "../state/enter-request";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";
import type { ActionPreviewIntent } from "./action-preview";

export const currentReviewPricesAtom = Atom.family(
  (intent: ActionPreviewIntent) =>
    Atom.make((get) => {
      const request = (() => {
        switch (intent) {
          case "enter": {
            const current = get(enterStakeRequestAtom);
            return current
              ? getTokensPricesRequest({
                  token: current.selectedToken,
                  yieldDto: current.selectedStake,
                })
              : null;
          }
          case "exit": {
            const current = get(exitStakeRequestAtom);
            return current
              ? getTokensPricesRequest({
                  token: current.unstakeToken,
                  yieldDto: current.integrationData,
                })
              : null;
          }
          case "manage": {
            const current = get(pendingActionRequestAtom);
            return current
              ? getTokensPricesRequest({
                  token: current.interactedToken,
                  yieldDto: current.integrationData,
                })
              : null;
          }
        }
      })();

      return get(pricesAtom(new PricesKey({ request })));
    })
);
