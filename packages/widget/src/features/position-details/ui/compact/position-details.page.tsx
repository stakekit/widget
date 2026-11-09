import { Match } from "effect";

import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { Stack } from "../../../../ui/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage, PageContainer } from "../../../widget-shell/views";
import { PositionDetailsActions } from "../components/position-details-actions";
import { PositionDetailsDisclosure } from "../components/position-details-disclosure";
import { PositionDetailsLoadFailed } from "../components/position-details-load-failed";
import { PositionDetailsSkeleton } from "../components/position-details-skeleton";
import { PositionHeader } from "../components/position-header";
import { PositionSummaryCard } from "../components/position-summary-card";
import { PositionYieldFacts } from "../components/position-yield-facts";
import { usePositionDetails } from "../use-position-details";

/**
 * A position's page in the compact Layout, in the Dashboard's order: the
 * header, the summary card, the actions, then the Details and the
 * yield's facts.
 * Entering further is a wide-Layout flow, so only the exit takes an amount.
 */
const PositionDetails = () => {
  const { integrationData, onRetry, page } = usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationData?.metadata.name,
  });

  if (page._tag === "PositionLost") {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  return (
    <AnimationPage>
      <PageContainer>
        {Match.value(page).pipe(
          Match.tag("Loading", () => <PositionDetailsSkeleton />),
          Match.tag("Failed", () => (
            <PositionDetailsLoadFailed onRetry={onRetry} />
          )),
          Match.tag("Ready", () => (
            <Stack grow gap={24}>
              <PositionHeader />
              <PositionSummaryCard />
              <PositionDetailsActions />
              <PositionDetailsDisclosure />
              <PositionYieldFacts />
            </Stack>
          )),
          Match.exhaustive
        )}
      </PageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetails />;
