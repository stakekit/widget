import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { Stack } from "../../../../ui/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage, PageContainer } from "../../../widget-shell/views";
import { usePositionDetails } from "../../react/use-position-details";
import { PositionDetailsActions } from "../components/position-details-actions";
import { PositionDetailsDisclosure } from "../components/position-details-disclosure";
import { PositionDetailsSkeleton } from "../components/position-details-skeleton";
import { PositionHeader } from "../components/position-header";
import { PositionSummaryCard } from "../components/position-summary-card";
import { PositionYieldFacts } from "../components/position-yield-facts";

/**
 * A position's page in the compact Layout, in the Dashboard's order: the
 * header, the summary card, the actions, then the Details and the
 * yield's facts.
 * Entering further is a wide-Layout flow, so only the exit takes an amount.
 */
const PositionDetails = () => {
  const { integrationData, isLoading, positionBalancesByType, positionLost } =
    usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationData?.metadata.name,
  });

  if (!isLoading && positionLost) {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  return (
    <AnimationPage>
      <PageContainer>
        {isLoading ? <PositionDetailsSkeleton /> : null}
        {!isLoading && integrationData && positionBalancesByType ? (
          <Stack grow gap={24}>
            <PositionHeader />
            <PositionSummaryCard />
            <PositionDetailsActions />
            <PositionDetailsDisclosure />
            <PositionYieldFacts />
          </Stack>
        ) : null}
      </PageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetails />;
