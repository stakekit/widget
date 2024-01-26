import { createPortal } from "react-dom";
import { RichErrorModal } from "../rich-error-modal";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";
import { HelpModal } from "../help-modal";
import { ReactPortal } from "react";
import { ReferralLock } from "../referral-lock";
import { useRootElement } from "../../../hooks/use-root-element";
import { Maybe } from "purify-ts";
import { useSettings } from "../../../providers/settings";

export const GlobalModals = () => {
  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const { referralCheck } = useSettings();

  const rootElement = useRootElement();

  return Maybe.fromNullable(rootElement)
    .map((root) => {
      if (geoBlock) {
        return createPortal(
          <HelpModal
            modal={{
              type: "geoBlock",
              ...geoBlock,
              regionCodeName: regionCodeName.data,
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
