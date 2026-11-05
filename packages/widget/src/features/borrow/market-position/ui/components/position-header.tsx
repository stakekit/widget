import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../domain/borrow/positions/market-position";
import { useTokenLogo } from "../../../../../shared/react/token-logo";
import { AssetHeader } from "../../../../../ui/index";
import { riskBandBadgeTone } from "../../../../borrow-transaction-flow/index";
import type { BorrowPositionContext } from "../context";

/**
 * The head of a market position's page: a 40px logo, the pair, who provides
 * it and the market, and its risk band as the status. Without debt nothing is
 * at risk, so no status shows.
 */
export const BorrowPositionHeader = ({
  model,
  position,
}: {
  readonly model: NonNullable<BorrowPositionContext["model"]>;
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();
  const headerLogo = useTokenLogo(model.headerToken);
  const providerLogo = position.integration.metadata.logoURI;

  return (
    <AssetHeader
      density="compact"
      title={model.title}
      token={headerLogo}
      provider={{
        name: model.providerName,
        label: t("positions.via", {
          providerName: model.providerName,
          count: 1,
        }),
        ...(providerLogo ? { src: providerLogo } : {}),
      }}
      details={[model.marketLabel]}
      badges={
        model.riskBand === null
          ? []
          : [
              {
                label: t(
                  `dashboard.borrow.position_details.risk_status.${model.riskBand}`
                ),
                tone: riskBandBadgeTone[model.riskBand],
              },
            ]
      }
    />
  );
};
