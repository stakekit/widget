import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  isRevealedConfidentialBalance,
  isUserRevealableBalance,
} from "../../../domain/earn/confidential-balance";
import { appRuntime } from "../../../runtime/app-runtime";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import {
  hideConfidentialPositions,
  revealConfidentialPositions,
} from "../../../services/zama/confidential-positions";
import { walletScopeAtom } from "../../wallet/index";
import type { PositionItem } from "../model/positions";
import { positionsTableDataAtom } from "./read-models/positions";
import { positionYieldsResultAtom } from "./read-models/summary";

/** Reveals every hidden confidential balance of the current owner. */
export const revealPortfolioBalancesAtom = walletRuntime
  .fn((_input: undefined, context) => {
    const scope = context(walletScopeAtom);
    if (!scope) return Effect.void;
    const yields = AsyncResult.getOrElse(
      context(positionYieldsResultAtom),
      () => null
    );
    return revealConfidentialPositions(
      scope,
      AsyncResult.getOrElse(
        context(positionsTableDataAtom),
        (): ReadonlyArray<PositionItem> => []
      ).flatMap((position) => {
        const yieldDto = yields?.get(position.integrationId);
        return yieldDto
          ? [{ balances: position.balancesWithAmount, yieldDto }]
          : [];
      })
    );
  })
  .pipe(Atom.withLabel("revealPortfolioBalancesAtom"));

export const hidePortfolioBalancesAtom = appRuntime
  .fn((_input: undefined, context) => {
    // Resetting ends a reveal still running, which would add back what Hide forgets.
    context.set(revealPortfolioBalancesAtom, Atom.Reset);
    const scope = context(walletScopeAtom);
    return scope ? hideConfidentialPositions(scope) : Effect.void;
  })
  .pipe(Atom.withLabel("hidePortfolioBalancesAtom"));

/** Which of Reveal and Hide the Manage overview offers, and the reveal's state. */
export const portfolioRevealViewAtom = Atom.make((get) => {
  const balances = AsyncResult.getOrElse(
    get(positionsTableDataAtom),
    (): ReadonlyArray<PositionItem> => []
  ).flatMap((position) => position.balancesWithAmount);
  const reveal = get(revealPortfolioBalancesAtom);
  return {
    canHide: balances.some(isRevealedConfidentialBalance),
    canReveal: balances.some(isUserRevealableBalance),
    revealFailed: AsyncResult.isFailure(reveal),
    revealing: AsyncResult.isWaiting(reveal),
  };
}).pipe(Atom.withLabel("portfolioRevealViewAtom"));
