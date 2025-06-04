import { useState } from "react";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { HelpModal } from "../help-modal";
import { RichErrorModal } from "../rich-error-modal";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const [hideGeoBlock, setHideGeoBlock] = useState(false);

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
      <RichErrorModal />
    </>
  );
};
