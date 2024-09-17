import { useUnderMaintenance } from "@sk-widget/hooks/use-under-maintenance";
import { useState } from "react";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { useSettings } from "../../../providers/settings";
import { HelpModal } from "../help-modal";
import { ReferralLock } from "../referral-lock";
import { RichErrorModal } from "../rich-error-modal";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const underMaintenance = useUnderMaintenance();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const [hideGeoBlock, setHideGeoBlock] = useState(false);
  const [hideUnderMaintenance, setHideMaintenance] = useState(false);

  const { referralCheck } = useSettings();

  if (underMaintenance && !hideUnderMaintenance) {
    return (
      <HelpModal
        modal={{
          type: "underMaintenance",
          onClose: () => setHideMaintenance(true),
        }}
      />
    );
  }

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
