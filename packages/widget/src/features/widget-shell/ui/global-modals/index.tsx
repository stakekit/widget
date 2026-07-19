import { useState } from "react";
import { useGeoBlock } from "../../../preferences/react/use-geo-block";
import { useRegionCodeName } from "../../../preferences/react/use-region-code-name";
import { useShowTOS } from "../../../preferences/react/use-show-tos";
import { HelpModal } from "../../../preferences/ui/help-modal";
import { TosModal } from "../../../preferences/ui/tos-modal";
import { RichErrorModal } from "../rich-error-modal";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const [hideGeoBlock, setHideGeoBlock] = useState(false);

  const { enabled, onAccept, tosAccepted } = useShowTOS();

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

  if (enabled && !tosAccepted) {
    return <TosModal isOpen onAccept={onAccept} onDecline={onAccept} />;
  }

  return <RichErrorModal />;
};
