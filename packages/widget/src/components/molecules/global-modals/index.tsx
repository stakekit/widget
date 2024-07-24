import { useState } from "react";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { useSettings } from "../../../providers/settings";
import { HelpModal } from "../help-modal";
import { ReferralLock } from "../referral-lock";
import { RichErrorModal } from "../rich-error-modal";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const [hideGeoBlock, setHideGeoBlock] = useState(false);

  const { referralCheck } = useSettings();

  if (geoBlock && !hideGeoBlock) {
    return (
      <HelpModal
        modal={{
          type: "geoBlock",
          ...geoBlock,
          regionCodeName: regionCodeName.data,
          onClose: () => setHideGeoBlock(true),
        }}
      />
    );
  }

  return (
    <>
      {referralCheck && <ReferralLock />}
      <RichErrorModal />
    </>
  );
};
