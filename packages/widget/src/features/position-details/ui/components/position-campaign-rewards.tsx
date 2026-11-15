import { CampaignRewardsSection } from "../../../campaigns/views";
import { usePositionDetailsWorkflowKey } from "../use-exit-or-pending-action";
import { usePositionDetails } from "../use-position-details";

/** The position's rewards in its yield's Campaign, for the route's wallet. */
export const PositionCampaignRewards = () => {
  const { scope } = usePositionDetailsWorkflowKey();
  const { integrationData } = usePositionDetails();

  return integrationData ? (
    <CampaignRewardsSection scope={scope} yieldDto={integrationData} />
  ) : null;
};
