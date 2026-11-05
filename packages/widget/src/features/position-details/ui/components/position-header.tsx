import { useTranslation } from "react-i18next";
import { YieldDetailsHeader } from "../../../yield-summary/views";
import {
  getPositionHeaderBadges,
  getPositionHeaderModel,
} from "../../model/position-overview";
import { usePositionDetails } from "../../react/use-position-details";

/**
 * The head of a position's page in both Layouts: a 40px logo, the name, who
 * provides it and the position's status, in place of a large logo block.
 */
export const PositionHeader = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const { integrationData, positionBalancesByType } = positionDetails;

  if (!integrationData || !positionBalancesByType) return null;

  const header = getPositionHeaderModel({
    cancellingHandles: positionDetails.cancellingHandles,
    canUnstake: positionDetails.canUnstake,
    integrationData,
    pendingActions: positionDetails.pendingActions ?? [],
    positionBalancesByType,
    providersDetails: positionDetails.providersDetails ?? [],
    t,
  });

  return (
    <YieldDetailsHeader
      density="compact"
      headerBadges={getPositionHeaderBadges(integrationData, t)}
      providerName={header.providerName}
      status={header.status}
      yieldDto={integrationData}
    />
  );
};
