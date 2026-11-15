import type { ComponentProps } from "react";

import { CampaignMetaInfo } from "../../../../campaigns/views";
import { useEarnEntry } from "../../use-earn-facades";

/** The selected yield's notes, with how its campaign pays among them. */
export const Footer = ({
  textSize,
}: {
  textSize?: ComponentProps<typeof CampaignMetaInfo>["textSize"];
}) => {
  const { view } = useEarnEntry();

  return (
    <CampaignMetaInfo
      isLoading={view.appLoading || view.footerIsLoading}
      selectedStake={view.selectedStake}
      selectedValidators={view.selectedValidators}
      selectedToken={view.selectedToken}
      textSize={textSize}
    />
  );
};
