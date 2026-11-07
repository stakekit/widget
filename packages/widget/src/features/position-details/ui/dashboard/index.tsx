import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { SplitView, Stack, Text } from "../../../../ui/index";
import {
  useWidgetNavigate,
  useWidgetRoutePrefixMatch,
} from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import {
  AnimationPage,
  BackButton,
  BackButtonProvider,
} from "../../../widget-shell/views";
import { resolvePositionDetailsPageLayout } from "../../model/hub";
import { usePositionDetails } from "../../react/use-position-details";
import { PositionDetailsDisclosure } from "../components/position-details-disclosure";
import { PositionHeader } from "../components/position-header";
import { PositionSummaryCard } from "../components/position-summary-card";
import { PositionYieldFacts } from "../components/position-yield-facts";
import {
  PositionDetailsBreadcrumb,
  PositionDetailsPane,
} from "./components/position-details-layout";

/**
 * The trail from the positions list. Off a flow, back returns to the list,
 * however the page was reached; in a flow, it steps back through it to the
 * position.
 */
const PositionBreadcrumb = ({
  flowActive,
  positionName,
}: {
  readonly flowActive: boolean;
  readonly positionName: string | null;
}) => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();

  return (
    <BackButtonProvider>
      <PositionDetailsBreadcrumb
        backButton={
          <BackButton
            testId="position-details-back"
            {...(flowActive
              ? {}
              : {
                  onClick: () =>
                    void navigation.push(widgetRoutes.positions.build()),
                })}
          />
        }
        positionName={positionName}
        rootLabel={t("dashboard.position_details.breadcrumb_root")}
      />
    </BackButtonProvider>
  );
};

/**
 * A position's own page, laid out as the Earn tab is: its actions on the
 * left, and on the right the position, its summary, its Details and the
 * yield's facts. A flow started from an action runs its Review, Steps and
 * Complete in the left column while the right keeps the position. The trail
 * back to the positions list always leads the page.
 */
const PositionDetailsPageComponent = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const enterFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionStake);
  const exitFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionUnstake);
  const pendingActionFlow = useWidgetRoutePrefixMatch(
    widgetRoutes.positionPendingAction
  );
  const flowActive =
    enterFlow !== null || exitFlow !== null || pendingActionFlow !== null;
  const layout = resolvePositionDetailsPageLayout({
    ...positionDetails,
    flowActive,
  });

  if (layout === "PositionLost") {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const shouldShowActions = layout === "Actions";
  // Off a flow the header names the position, so the trail stops at its root.
  const positionName = flowActive
    ? (positionDetails.integrationData?.metadata.name ?? null)
    : null;
  const head = (
    <>
      <PositionBreadcrumb flowActive={flowActive} positionName={positionName} />
      {flowActive ? null : <PositionHeader />}
    </>
  );

  return (
    <AnimationPage>
      <SplitView
        secondaryLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowActions ? (
            <PositionDetailsPane kind="actions">
              {head}

              <Stack grow gap={32} justify="between">
                <Outlet />
              </Stack>
            </PositionDetailsPane>
          ) : null
        }
        secondary={
          <PositionDetailsPane kind="info">
            {shouldShowActions ? null : head}

            {layout === "InfoOnly" ? (
              <Stack align="center">
                <Text tone="muted">
                  {t("dashboard.position_details.empty")}
                </Text>
              </Stack>
            ) : (
              <>
                <PositionSummaryCard />
                <PositionDetailsDisclosure />
                <PositionYieldFacts />
              </>
            )}
          </PositionDetailsPane>
        }
      />
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetailsPageComponent />;
