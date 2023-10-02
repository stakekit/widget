import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../atoms/box";
import { HelpIcon } from "../../atoms/icons";
import { SelectModal } from "../../atoms/select-modal";
import poweredBy from "../../../assets/images/powered-by.png";
import whatIsStaking from "../../../assets/images/what-is-staking.png";
import whatIsLiquidStaking from "../../../assets/images/what-is-liquid-staking.png";
import whatIsDeposit from "../../../assets/images/what-is-deposit.png";
import whatIsLending from "../../../assets/images/what-is-lending.png";
import fees from "../../../assets/images/fees.png";
import { Heading, Text } from "../../atoms/typography";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { imageStyle } from "./style.css";
import { YieldType } from "@stakekit/api-hooks";
import { formatCountryCode } from "../../../utils/formatters";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { ReactNode } from "react";
import { SKAnchor } from "../../atoms/anchor";
import { Button } from "../../atoms/button";

type ModalType =
  | { type: "fees" }
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
          image: whatIsStaking,
        };
      }

      case "liquid-staking": {
        return {
          title: t("help_modals.liquid_staking.title"),
          description: t("help_modals.liquid_staking.description"),
          image: whatIsLiquidStaking,
        };
      }

      case "vault": {
        return {
          title: t("help_modals.deposit.title"),
          description: t("help_modals.deposit.description"),
          image: whatIsDeposit,
        };
      }

      case "lending": {
        return {
          title: t("help_modals.lending.title"),
          description: t("help_modals.lending.description"),
          image: whatIsLending,
        };
      }

      case "fees": {
        return {
          title: t("help_modals.fees.title"),
          description: t("help_modals.fees.description"),
          image: fees,
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
            image: fees,
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
            image: fees,
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
            image: fees,
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
            image: fees,
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
            image: fees,
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
            image: fees,
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
            image: fees,
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
          image: fees,
        };
      }

      case "getInTouch": {
        return {
          title: t("help_modals.get_in_touch.title"),
          button: {
            title: t("help_modals.get_in_touch.button"),
            onClick: () =>
              window.open("https://twitter.com/stakekit", "_blank"),
          },
          description: "",
          image: whatIsStaking,
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
                link1: <SKAnchor href="https://www.stakek.it/" />,
              }}
            />
          ),
          image: poweredBy,
        };
      }
    }
  };

  const { description, image, title, link, button } = getContent(modal);

  return (
    <SelectModal
      forceOpen={modal.type === "geoBlock"}
      trigger={
        <Trigger asChild={!!customTrigger}>
          {customTrigger ?? (
            <Box display="flex" alignItems="center" justifyContent="center">
              <HelpIcon />
            </Box>
          )}
        </Trigger>
      }
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={{ tablet: "8", mobile: "4" }}
        paddingBottom={{ mobile: "8" }}
      >
        <Box as="img" src={image} className={imageStyle} />

        <Heading variant={{ level: "h4" }}>{title}</Heading>

        <Box marginTop="2" lineHeight="short">
          <Text
            variant={{ size: "standard", type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {description}
          </Text>
        </Box>

        {!!link && <SKAnchor>{link}</SKAnchor>}

        {button && (
          <Box marginTop="4" width="full">
            <Button variant={{ color: "secondary" }} onClick={button.onClick}>
              <Text variant={{ size: "standard", weight: "bold" }}>
                {button.title}
              </Text>
            </Button>
          </Box>
        )}
      </Box>
    </SelectModal>
  );
};
