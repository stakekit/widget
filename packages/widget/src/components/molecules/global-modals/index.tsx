import { useState } from "react";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { useShowTOS } from "../../../hooks/use-show-tos";
import { HelpModal } from "../help-modal";
import { RichErrorModal } from "../rich-error-modal";
import { TosModal } from "../tos-modal";

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
