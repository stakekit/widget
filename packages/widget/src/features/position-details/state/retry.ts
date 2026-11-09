import type * as Atom from "effect/reactivity/Atom";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import { yieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/index";
import { refreshYieldPositionsAtom } from "../../../resources/yield-positions/index";

/**
 * Loads a position's yield and the wallet's positions again after they failed
 * to load. What still shows keeps its value while it reloads.
 */
export const retryPositionDetailsLoad = (
  context: Atom.FnContext,
  {
    scope,
    yieldId,
  }: {
    readonly scope: WalletScopeKey;
    readonly yieldId: YieldId | null;
  }
) => {
  if (yieldId !== null) {
    context.refresh(yieldOpportunityResourceAtom.local(yieldId));
  }
  context.set(refreshYieldPositionsAtom(scope), undefined);
};
