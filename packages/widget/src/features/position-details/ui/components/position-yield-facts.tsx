import { useAtomValue } from "@effect/atom-react";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { YieldFactsSection } from "../../../yield-summary/views";
import { usePositionDetails } from "../../react/use-position-details";
import { usePositionOverview } from "../../react/use-position-overview";

/**
 * The yield's facts after the position's Details, in both Layouts, as the
 * Earn tab shows them: without the facts the page already shows, such as the
 * reward rate its summary leads with.
 */
export const PositionYieldFacts = () => {
  const { integrationData, page } = usePositionDetails();
  const overview = usePositionOverview();
  const now = useAtomValue(presentationClockAtom)?.now ?? null;

  if (page._tag === "Loading" || !overview || !integrationData) return null;

  return (
    <YieldFactsSection
      now={now}
      omit={overview.omittedYieldFacts}
      yieldDto={integrationData}
    />
  );
};
