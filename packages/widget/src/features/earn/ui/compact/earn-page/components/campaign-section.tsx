import { CampaignSection } from "../../../../../campaigns/views";
import { useEarnEntry } from "../../../use-earn-facades";

/**
 * The selected yield's Campaign section at the end of the form, collapsed
 * until the user or its strip opens it: the Compact Layout has no details
 * pane.
 */
export const EarnCampaignSection = () => {
  const { view } = useEarnEntry();

  return view.selectedStake ? (
    <CampaignSection yieldDto={view.selectedStake} defaultOpen={false} />
  ) : null;
};
