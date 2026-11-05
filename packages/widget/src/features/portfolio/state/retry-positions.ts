import * as Atom from "effect/reactivity/Atom";
import { borrowIntegrationsResourceAtom } from "../../../resources/borrow-integrations/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../resources/borrow-positions/index";
import { walletScopeAtom } from "../../wallet/index";
import { widgetConfigAtom } from "../../widget-configuration/index";
import { yieldBalancesScanAtom } from "./read-models/yield-balances";

/**
 * Loads the Manage list's sources again after a failure: the yield positions
 * and, where Borrow is enabled, the Borrow integrations and the wallet's
 * borrow positions. Positions refresh only their own data, so a failed
 * integrations load is refreshed here.
 */
export const retryPositionsAtom = Atom.fnSync((_input: undefined, get) => {
  get.set(yieldBalancesScanAtom, undefined);

  const scope = get(walletScopeAtom);
  if (!get(widgetConfigAtom).borrowEnabled || scope === null) return;

  get.refresh(borrowIntegrationsResourceAtom.local);
  get.refresh(
    borrowPositionsResourceAtom.local(new BorrowPositionsKey({ scope }))
  );
}).pipe(Atom.withLabel("retryPositionsAtom"));
