import type { ReactNode } from "react";
import { isValidElement, useEffect, useEffectEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { images } from "../../../../shared/assets/images";
import { formatCountryCode } from "../../../../shared/lib/formatters";
import { SKAnchor } from "../../../../shared/ui/primitives/anchor";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button, Icon, Modal } from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import type { useGeoBlock } from "../../react/use-geo-block";
import { WidgetTranslationGate } from "../../react/widget-translation-gate";
import { imageStyle } from "./style.css";

type ModalType =
  | ({ type: "geoBlock"; onClose: () => void } & Exclude<
      ReturnType<typeof useGeoBlock>,
      false
    > & {
        regionCodeName: string | undefined;
      })
  | { type: "getInTouch" }
  | { type: "whatIsStakeKit" };

type HelpModalProps = {
  modal: ModalType;
  customTrigger?: ReactNode;
};

const HelpModalContent = ({ modal, customTrigger }: HelpModalProps) => {
  const { t, i18n } = useTranslation();

  const getContent = (
    modal: ModalType
  ): {
    title: string;
    description: string | ReactNode;
    image: string;
    button?: { title: string; onClick: () => void };
  } => {
    switch (modal.type) {
      case "geoBlock": {
        const title = t("help_modals.geo_block.title");
        const countryName = formatCountryCode({
          language: i18n.language,
          countryCode: modal.countryCode,
        });

        if (modal.tags.has("OFAC") && modal.tags.has("OFSI")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.ofac_ofsi"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("OFSI") && modal.tags.has("Crypto Ban")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.ofsi_crypto_ban"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("Crypto Ban")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.crypto_ban"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("OFAC")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.ofac"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("OFSI")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.ofsi"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("Pending Litigation")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.pending_litigation"
                values={{
                  countryName,
                  nameOfRegion: modal.regionCodeName ?? "",
                }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }
        if (modal.tags.has("Staking Ban")) {
          return {
            title,
            description: (
              <Trans
                i18nKey="help_modals.geo_block.staking_ban"
                values={{ countryName }}
                components={{ link0: <SKAnchor /> }}
              />
            ),
            image: images.fees,
          };
        }

        return {
          title,
          description: (
            <Trans
              i18nKey="help_modals.geo_block.default"
              values={{ countryName }}
              components={{ link0: <SKAnchor /> }}
            />
          ),
          image: images.fees,
        };
      }

      case "getInTouch": {
        return {
          title: t("help_modals.get_in_touch.title"),
          button: {
            title: t("help_modals.get_in_touch.button"),
            onClick: () =>
              window.open("https://twitter.com/yield_xyz", "_blank"),
          },
          description: "",
          image: images.whatIsLiquidStaking,
        };
      }

      case "whatIsStakeKit": {
        return {
          title: t("help_modals.what_is_stakekit.title"),
          description: (
            <Trans
              i18nKey="help_modals.what_is_stakekit.description"
              components={{
                br0: <br />,
                link0: <SKAnchor href="https://yield.xyz/" />,
                link1: <SKAnchor href="https://docs.yield.xyz/docs/faqs" />,
              }}
            />
          ),
          image: images.poweredBy,
        };
      }
    }
  };

  // HelpModal can be used as SKApp children (outside the widget frame) under the
  // same Application Runtime registry; tracking uses that tree's config.
  const trackEvent = useTrackEvent();

  const { description, image, title, button } = getContent(modal);

  const isGeoBlock = modal.type === "geoBlock";

  const reportOpened = useEffectEvent(() =>
    trackEvent("helpModalOpened", { modal: title })
  );

  useEffect(() => {
    if (!isGeoBlock) return;

    reportOpened();
  }, [isGeoBlock]);

  // A geo-block notice is open while it is rendered; help content opens from
  // its trigger: the host's element, or a help icon button.
  const openProps =
    modal.type === "geoBlock"
      ? {
          open: true,
          onOpenChange: (open: boolean) => {
            if (!open) modal.onClose();
          },
        }
      : {
          trigger: isValidElement(customTrigger) ? (
            customTrigger
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={customTrigger === undefined ? title : undefined}
            >
              {customTrigger ?? <Icon name="HelpIcon" />}
            </Button>
          ),
          onOpenChange: (open: boolean) => {
            if (open) trackEvent("helpModalOpened", { modal: title });
          },
        };

  return (
    <Modal
      {...openProps}
      title={title}
      description={description === "" ? undefined : description}
      closeLabel={t("help_modals.close")}
      footer={
        button && (
          <Button variant="secondary" size="cta" onClick={button.onClick}>
            {button.title}
          </Button>
        )
      }
    >
      <Box display="flex" justifyContent="center">
        <Box as="img" src={image} alt="" className={imageStyle} />
      </Box>
    </Modal>
  );
};

export const HelpModal = (props: HelpModalProps) => (
  <WidgetTranslationGate>
    <HelpModalContent {...props} />
  </WidgetTranslationGate>
);
