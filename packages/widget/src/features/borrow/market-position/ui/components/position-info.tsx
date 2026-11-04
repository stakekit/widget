import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../domain/borrow/positions/market-position";
import { formatAddress } from "../../../../../shared/lib/general";
import { useTokenLogo } from "../../../../../shared/react/token-logo";
import {
  AssetHeader,
  DetailList,
  DetailRow,
  Disclosure,
  EmptyState,
  Stack,
} from "../../../../../ui/index";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../../model/details";
import { CollateralList } from "./collateral-list";
import { LtvGauge } from "./ltv-gauge";
import { MetricCards } from "./metric-cards";

type BorrowPositionDetailsModel = ReturnType<
  typeof getBorrowPositionDetailsModel
>;

export const BorrowPositionInfo = ({
  actions,
  content,
  model,
  onActionSelect,
  position,
}: {
  readonly actions: BorrowPositionAction[];
  readonly content: "details" | "fallback";
  readonly model: BorrowPositionDetailsModel | null;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly position: MarketPosition | null;
}) => {
  const { t } = useTranslation();

  if (content === "fallback" || !position || !model) {
    return <EmptyState title={t("dashboard.borrow.position_details.empty")} />;
  }

  return (
    <BorrowPositionDetails
      actions={actions}
      model={model}
      onActionSelect={onActionSelect}
      position={position}
    />
  );
};

const BorrowPositionDetails = ({
  actions,
  model,
  onActionSelect,
  position,
}: {
  readonly actions: BorrowPositionAction[];
  readonly model: BorrowPositionDetailsModel;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();
  const headerLogo = useTokenLogo(model.headerToken);
  const providerLogo = position.integration.metadata.logoURI;

  return (
    <Stack gap={24}>
      <AssetHeader
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
      />

      <MetricCards
        cards={model.metricCards}
        healthFactor={model.healthFactor}
      />

      <LtvGauge
        currentLtv={model.currentLtv}
        liquidationThreshold={model.liquidationThreshold}
        maxLtv={model.maxLtv}
      />

      <CollateralList
        actions={actions}
        items={model.collateralItems}
        onActionSelect={onActionSelect}
        totalCollateralUsd={model.totalCollateralUsd}
      />

      {model.breakdownRows.length > 0 && (
        <Disclosure
          title={t("dashboard.position_details.breakdown")}
          defaultOpen
        >
          <DetailList>
            {model.breakdownRows.map((row) => (
              <DetailRow
                key={row.id}
                label={row.label}
                value={row.value}
                {...(row.subValue ? { caption: row.subValue } : {})}
              />
            ))}
          </DetailList>
        </Disclosure>
      )}

      <Disclosure
        title={t("dashboard.borrow.position_details.details")}
        defaultOpen
      >
        <DetailList>
          {model.detailRows.map((row) => (
            <DetailRow key={row.id} label={row.label} value={row.value} />
          ))}
          <DetailRow
            label={t("dashboard.borrow.details.pool_address")}
            value={formatAddress(position.market.poolAddress)}
            copyable={{
              value: position.market.poolAddress,
              label: t("wallet_modal.copy_address"),
              copiedLabel: t("wallet_modal.copied"),
            }}
          />
        </DetailList>
      </Disclosure>
    </Stack>
  );
};
