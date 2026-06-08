import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { Image } from "../../../../components/atoms/image";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { Text } from "../../../../components/atoms/typography/text";
import {
  getDashboardYieldCategory,
  type Yield,
} from "../../../../domain/types/yields";
import {
  formatDisplayTokenSymbol,
  formatNetworkName,
} from "../earn-details-formatters";
import type { EarnDetailsHeaderBadge } from "../earn-details-model";
import * as styles from "../styles.css";

export const EarnDetailsHeader = ({
  headerBadges,
  providerName,
  yieldDto,
}: {
  headerBadges: EarnDetailsHeaderBadge[];
  providerName: string;
  yieldDto: Yield;
}) => (
  <Box display="flex" alignItems="center" gap="3">
    <TokenIcon
      metadata={{
        logoURI: yieldDto.metadata.logoURI,
        name: yieldDto.metadata.name,
        provider: yieldDto.provider,
      }}
      token={yieldDto.token}
      tokenLogoHw="12"
    />

    <Box minWidth="0">
      <Text className={styles.titleText} variant={{ weight: "bold" }}>
        {formatDetailsTitle({ providerName, yieldDto })}
      </Text>

      <Box className={styles.headerBadgeRow}>
        <ProviderLabel providerName={providerName} yieldDto={yieldDto} />

        <Text
          className={styles.headerProviderText}
          variant={{ type: "muted", weight: "normal" }}
        >
          {" · "}
          {formatNetworkName(yieldDto.network)}
          {" · "}
          {formatDisplayTokenSymbol(yieldDto)}
        </Text>

        {headerBadges.length > 0 ? (
          <Text
            as="span"
            className={styles.headerBadgeSeparator}
            variant={{ type: "muted", weight: "normal" }}
          >
            {" · "}
          </Text>
        ) : null}

        {headerBadges.map((badge) => (
          <Box
            className={
              badge.tone === "auto"
                ? styles.headerAutoBadge
                : styles.headerBadge
            }
            key={badge.label}
          >
            <Text
              as="span"
              className={styles.headerBadgeText}
              variant={{ type: "base", weight: "bold", size: "small" }}
            >
              {badge.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

const ProviderLabel = ({
  providerName,
  yieldDto,
}: {
  providerName: string;
  yieldDto: Yield;
}) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" alignItems="center" gap="1" flexShrink={0}>
      <Image
        wrapperProps={{ hw: "5" }}
        imgProps={{ borderRadius: "base" }}
        src={yieldDto.provider?.logoURI}
        fallbackName={providerName}
      />
      <Text
        className={styles.headerProviderLabelText}
        variant={{ weight: "normal" }}
      >
        {t("positions.via", { providerName, count: 1 })}
      </Text>
    </Box>
  );
};

const formatDetailsTitle = ({
  providerName,
  yieldDto,
}: {
  providerName: string;
  yieldDto: Yield;
}) => {
  const name = yieldDto.metadata.name;

  if (
    getDashboardYieldCategory(yieldDto) !== "stake" ||
    name.toLowerCase().includes(providerName.toLowerCase())
  ) {
    return name;
  }

  return `${name} via ${providerName}`;
};
