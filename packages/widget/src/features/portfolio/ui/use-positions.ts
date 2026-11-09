import { useAtomValue } from "@effect/atom-react";

import {
  earnPositionsPageAtom,
  portfolioPositionsPageAtom,
} from "../state/positions-page";
import { portfolioPendingActionsCountAtom } from "../state/read-models/positions";

export const useEarnPositionsPage = () => useAtomValue(earnPositionsPageAtom);

export const usePortfolioPositionsPage = () =>
  useAtomValue(portfolioPositionsPageAtom);

/** How many positions ask for the user's attention (see the atom). */
export const usePortfolioPendingActionsCount = () =>
  useAtomValue(portfolioPendingActionsCountAtom);
