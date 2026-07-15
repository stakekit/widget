import { useState } from "react";
import {
  HelpModal,
  TosModal,
  useGeoBlock,
  useRegionCodeName,
  useShowTOS,
} from "../../../preferences";
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
