import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { currentYieldRewardsSummaryAtom } from "../../yield-summary/index";
import {
  getPositionOverviewModel,
  type PositionOverviewModel,
} from "../model/position-overview";
import { positionOverviewViewAtom } from "../state/details-view";
import { usePositionDetailsWorkflowKey } from "./use-exit-or-pending-action";

/**
 * The position's summary figures and Details facts, in both Layouts; null
 * until the position and its balances load. It reads the position without
 * the exit form's amount, so typing one does not render it again.
 */
export const usePositionOverview = (): PositionOverviewModel | null => {
  const workflowKey = usePositionDetailsWorkflowKey();
  const position = useAtomValue(positionOverviewViewAtom(workflowKey));
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const { integrationData, positionBalancesByType, positionRate } = position;
  const rewardsSummary = useAtomValue(
    currentYieldRewardsSummaryAtom(integrationData?.id ?? null)
  );

  if (!integrationData || !positionBalancesByType || !positionRate) return null;

  return getPositionOverviewModel({
    cancellingHandles: position.cancellingHandles,
    integrationData,
    locale,
    now: presentationTime?.now ?? null,
    positionBalancesByType,
    rate: positionRate,
    rewardsSummary,
    t,
  });
};
