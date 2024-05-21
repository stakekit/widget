import { Maybe } from "purify-ts";
import { type ReactPortal, useState } from "react";
import { createPortal } from "react-dom";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { useRootElement } from "../../../providers/root-element";
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

  const rootElement = useRootElement();

  return Maybe.fromNullable(rootElement)
    .map((root) => {
      if (geoBlock && !hideGeoBlock) {
        return createPortal(
          <HelpModal
            modal={{
              type: "geoBlock",
              ...geoBlock,
              regionCodeName: regionCodeName.data,
              onClose: () => setHideGeoBlock(true),
            }}
          />,
          root
        ) as ReactPortal;
      }

      return createPortal(
        <>
          {referralCheck && <ReferralLock />}
          <RichErrorModal />
        </>,
        root
      ) as ReactPortal;
    })
    .extractNullable();
};
