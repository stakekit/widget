import { useState } from "react";
import {
  useGeoBlock,
  useRegionCodeName,
  useShowTOS,
} from "../../../preferences/index";
import { HelpModal, TosModal } from "../../../preferences/views";
import { RichErrorModal } from "../rich-error-modal";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const [hideGeoBlock, setHideGeoBlock] = useState(false);

  const { acknowledged, enabled, onAcknowledge, resolving } = useShowTOS();

  if (geoBlock && !hideGeoBlock) {
    return (
      <HelpModal
        modal={{
          type: "geoBlock",
          ...geoBlock,
          regionCodeName,
          onClose: () => setHideGeoBlock(true),
        }}
      />
    );
  }

  if (enabled && !acknowledged && !resolving) {
    return (
      <TosModal isOpen onAccept={onAcknowledge} onDecline={onAcknowledge} />
    );
  }

  return <RichErrorModal />;
};
