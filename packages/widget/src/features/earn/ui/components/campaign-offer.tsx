import { CampaignOfferBanner } from "../../../campaigns/views";
import { useEarnCampaignOffer } from "../use-earn-facades";

/**
 * The Campaign Offer at the top of Earn while the selected yield has no
 * earning campaign; switching selects the offered token and yield.
 */
export const EarnCampaignOffer = () => {
  const { offer, select } = useEarnCampaignOffer();

  return offer ? (
    <CampaignOfferBanner
      yieldDto={offer.yieldDto}
      onSwitch={() => select(offer.target)}
    />
  ) : null;
};
