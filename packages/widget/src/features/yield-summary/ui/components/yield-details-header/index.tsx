import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { getYieldCategory } from "../../../../../domain/earn/yield";
import { formatNetworkName } from "../../../../../shared/lib/formatters";
import { useTokenLogo } from "../../../../../shared/react/token-logo";
import { AssetHeader } from "../../../../../ui/index";
import { formatDisplayTokenSymbol } from "../../../model/yield-details-formatters";

type YieldDetailsHeaderBadge = Readonly<{
  readonly label: string;
  readonly tone: "default" | "auto";
}>;

const badgeTones = {
  default: "neutral",
  auto: "accent",
} as const;

/**
 * A yield's or position's header. A position's page passes `compact`: the
 * title is the yield's own name, as the line under it already names the
 * provider.
 */
export const YieldDetailsHeader = ({
  density = "default",
  headerBadges,
  providerName,
  yieldDto,
}: {
  readonly density?: "default" | "compact";
  readonly headerBadges: ReadonlyArray<YieldDetailsHeaderBadge>;
  readonly providerName: string;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const token = useTokenLogo(yieldDto.outputToken ?? yieldDto.token, {
    metadata: {
      logoURI: yieldDto.metadata.logoURI,
      name: yieldDto.metadata.name,
      provider: yieldDto.provider,
    },
  });
  const providerLogo = yieldDto.provider?.logoURI;

  return (
    <AssetHeader
      density={density}
      title={
        density === "compact"
          ? yieldDto.metadata.name
          : formatDetailsTitle({ providerName, yieldDto })
      }
      token={token}
      provider={{
        name: providerName,
        label: t("positions.via", { providerName, count: 1 }),
        ...(providerLogo ? { src: providerLogo } : {}),
      }}
      // A position's page reads "via Provider · Network"; its summary card
      // names the token with the amount.
      details={
        density === "compact"
          ? [formatNetworkName(yieldDto.network)]
          : [
              formatNetworkName(yieldDto.network),
              formatDisplayTokenSymbol(yieldDto),
            ]
      }
      badges={headerBadges.map((badge) => ({
        label: badge.label,
        tone: badgeTones[badge.tone],
      }))}
    />
  );
};

const formatDetailsTitle = ({
  providerName,
  yieldDto,
}: {
  readonly providerName: string;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const name = yieldDto.metadata.name;

  if (
    getYieldCategory(yieldDto) !== "stake" ||
    name.toLowerCase().includes(providerName.toLowerCase())
  ) {
    return name;
  }

  return `${name} via ${providerName}`;
};
