import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  hidePortfolioBalancesAtom,
  portfolioRevealViewAtom,
  revealPortfolioBalancesAtom,
} from "../state/reveal-balances";

export const useRevealBalances = () => {
  const view = useAtomValue(portfolioRevealViewAtom);
  const reveal = useAtomSet(revealPortfolioBalancesAtom);
  const hide = useAtomSet(hidePortfolioBalancesAtom);

  return {
    ...view,
    onHide: () => hide(undefined),
    onReveal: () => reveal(undefined),
  };
};
