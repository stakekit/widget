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
import { Text } from "../../atoms/typography";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { imageStyle, linkStyle } from "./style.css";
import { YieldType } from "@stakekit/api-hooks";
import { formatCountryCode } from "../../../utils/formatters";
import { useGeoBlock } from "../../../hooks/use-geo-block";
import { ReactNode } from "react";
import { SKAnchor } from "../../atoms/anchor";
import { useRegionCodeName } from "../../../hooks/use-region-code-names";

type ModalType =
  | { type: "main" }
  | { type: "fees" }
  | ({ type: "geoBlock" } & Exclude<ReturnType<typeof useGeoBlock>, false>)
  | { type: YieldType };

type HelpModalProps = {
  modal: ModalType;
};

export const HelpModal = ({ modal }: HelpModalProps) => {
  const { t, i18n } = useTranslation();

  const regionCodeName = useRegionCodeName(
    modal.type === "geoBlock" ? modal.regionCode : undefined
  );

  const getContent = (
    modal: ModalType
  ): {
    title: string;
    description: string | ReactNode;
    image: string;
    link?: string;
  } => {
    switch (modal.type) {
      case "main": {
        return {
          title: t("help_modals.main.title"),
          description: t("help_modals.main.description"),
          image: poweredBy,
          link: "https://stakek.it",
        };
      }

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
                  nameOfRegion: regionCodeName.data ?? "",
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
    }
  };

  const { description, image, title, link } = getContent(modal);

  return (
    <SelectModal
      forceOpen={modal.type === "geoBlock"}
      trigger={
        <Trigger>
          <Box display="flex" alignItems="center" justifyContent="center">
            <HelpIcon />
          </Box>
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

        <Text variant={{ size: "standard" }}>{title}</Text>

        <Box marginTop="2">
          <Text
            variant={{ size: "small", type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {description}
          </Text>
        </Box>

        {link && (
          <Box
            as="a"
            href={link}
            target="_blank"
            marginTop="2"
            className={linkStyle}
          >
            <Text variant={{ size: "small", weight: "normal" }}>{link}</Text>
          </Box>
        )}
      </Box>
    </SelectModal>
  );
};
