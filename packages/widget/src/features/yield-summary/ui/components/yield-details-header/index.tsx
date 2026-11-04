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

export const YieldDetailsHeader = ({
  headerBadges,
  providerName,
  yieldDto,
}: {
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
      title={formatDetailsTitle({ providerName, yieldDto })}
      token={token}
      provider={{
        name: providerName,
        label: t("positions.via", { providerName, count: 1 }),
        ...(providerLogo ? { src: providerLogo } : {}),
      }}
      details={[
        formatNetworkName(yieldDto.network),
        formatDisplayTokenSymbol(yieldDto),
      ]}
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
