import { useTranslation } from "react-i18next";
import { YieldDetailsHeader } from "../../../yield-summary/views";
import {
  getPositionHeaderBadges,
  getPositionProviderName,
} from "../../model/position-overview";
import { usePositionDetails } from "../../react/use-position-details";

/**
 * The head of a position's page in both Layouts: a 40px logo, the name and
 * who provides it on which network. The positions list row carries the
 * position's status; the page does not repeat it.
 */
export const PositionHeader = () => {
  const { t } = useTranslation();
  const { integrationData, providersDetails } = usePositionDetails();

  if (!integrationData) return null;

  return (
    <YieldDetailsHeader
      density="compact"
      headerBadges={getPositionHeaderBadges(integrationData, t)}
      providerName={getPositionProviderName({
        integrationData,
        providersDetails: providersDetails ?? [],
      })}
      yieldDto={integrationData}
    />
  );
};
