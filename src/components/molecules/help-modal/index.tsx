import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../atoms/box";
import { HelpIcon } from "../../atoms/icons";
import type { SelectModalProps } from "../../atoms/select-modal";
import { SelectModal } from "../../atoms/select-modal";
import { Heading, Text } from "../../atoms/typography";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { container, imageStyle } from "./style.css";
import type { YieldType } from "@stakekit/api-hooks";
import { formatCountryCode } from "../../../utils/formatters";
import type { useGeoBlock } from "../../../hooks/use-geo-block";
import type { ReactNode } from "react";
import { useContext, useMemo } from "react";
import { SKAnchor } from "../../atoms/anchor";
import { Button } from "../../atoms/button";
import { TrackingContext } from "../../../providers/tracking";
import { MaybeWindow } from "../../../utils/maybe-window";
import { images } from "../../../assets/images";

type ModalType =
  | ({ type: "geoBlock" } & Exclude<ReturnType<typeof useGeoBlock>, false> & {
        regionCodeName: string | undefined;
      })
  | { type: YieldType }
  | { type: "getInTouch" }
  | { type: "whatIsStakeKit" };

type HelpModalProps = {
  modal: ModalType;
  customTrigger?: ReactNode;
};

export const HelpModal = ({ modal, customTrigger }: HelpModalProps) => {
  const { t, i18n } = useTranslation();

  const getContent = (
    modal: ModalType
  ): {
    title: string;
    description: string | ReactNode;
    image: string;
    link?: string;
    button?: { title: string; onClick: () => void };
  } => {
    switch (modal.type) {
      case "staking": {
        return {
          title: t("help_modals.staking.title"),
          description: t("help_modals.staking.description"),
          image: images.whatIsStaking,
        };
      }

      case "liquid-staking": {
        return {
          title: t("help_modals.liquid_staking.title"),
          description: t("help_modals.liquid_staking.description"),
          image: images.whatIsLiquidStaking,
        };
      }

      case "vault": {
        return {
          title: t("help_modals.deposit.title"),
          description: t("help_modals.deposit.description"),
          image: images.whatIsDeposit,
        };
      }

      case "lending": {
        return {
          title: t("help_modals.lending.title"),
          description: t("help_modals.lending.description"),
          image: images.whatIsLending,
        };
      }

      case "restaking": {
        return {
          title: t("help_modals.restaking.title"),
          description: t("help_modals.restaking.description"),
          image: images.whatIsStaking,
        };
      }

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
        } else if (modal.tags.has("OFSI") && modal.tags.has("Crypto Ban")) {
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
        } else if (modal.tags.has("Crypto Ban")) {
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
        } else if (modal.tags.has("OFAC")) {
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
        } else if (modal.tags.has("OFSI")) {
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
        } else if (modal.tags.has("Pending Litigation")) {
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
        } else if (modal.tags.has("Staking Ban")) {
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
              MaybeWindow.ifJust((w) =>
                w.open("https://twitter.com/stakekit", "_blank")
              ),
          },
          description: "",
          image: images.whatIsStaking,
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
                link0: <SKAnchor href="https://www.stakek.it/" />,
                link1: <SKAnchor href="https://docs.stakek.it/docs/faqs" />,
              }}
            />
          ),
          image: images.poweredBy,
        };
      }
    }
  };

  // HelpModal can be used out of default Widget context
  const trackEvent = useContext(TrackingContext)?.trackEvent;

  const { description, image, title, link, button } = getContent(modal);

  const selectModalProps = useMemo<SelectModalProps>(() => {
    const base: SelectModalProps = {
      onOpen: () => trackEvent?.("helpModalOpened", { modal: title }),
    };

    return modal.type === "geoBlock"
      ? {
          ...base,
          hideTopBar: true,
          disableClose: true,
          state: {
            isOpen: true,
            setOpen: () => {},
          },
        }
      : {
          ...base,
          trigger: (
            <Trigger asChild={!!customTrigger}>
              {customTrigger ?? (
                <Box display="flex" alignItems="center" justifyContent="center">
                  <HelpIcon />
                </Box>
              )}
            </Trigger>
          ),
        };
  }, [customTrigger, modal.type, title, trackEvent]);

  return (
    <SelectModal {...selectModalProps}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={container}
      >
        <Box as="img" src={image} className={imageStyle} />

        <Heading variant={{ level: "h4" }}>{title}</Heading>

        <Box marginTop="2" lineHeight="short">
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {description}
          </Text>
        </Box>

        {!!link && <SKAnchor>{link}</SKAnchor>}

        {button && (
          <Box marginTop="4" width="full">
            <Button variant={{ color: "secondary" }} onClick={button.onClick}>
              <Text variant={{ weight: "bold" }}>{button.title}</Text>
            </Button>
          </Box>
        )}
      </Box>
    </SelectModal>
  );
};
