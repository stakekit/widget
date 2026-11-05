import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import type { RiskGateBlockReason } from "../../../../../domain/borrow/risk/risk-gate";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Card,
  DetailList,
  DetailRow,
  Notice,
  Stack,
  Text,
} from "../../../../../ui/index";
import type { BorrowMarketWalletBalances } from "../../../action-preparation/index";
import type { BorrowFormProjection } from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";

export const BorrowFormDetails = ({
  borrowAmount,
  collateralAmount,
  market,
  projection,
  riskBlock,
  riskWarning,
  walletBalances,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly market: Market;
  readonly projection: BorrowFormProjection;
  readonly riskBlock: RiskGateBlockReason | null;
  readonly riskWarning: boolean;
  readonly walletBalances: BorrowMarketWalletBalances | null;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const model = getBorrowDetailsModel({
    collateralToken:
      walletBalances?.selectedCollateralToken?.collateralToken ?? null,
    borrowAmount,
    collateralAmount,
    integration: null,
    locale,
    market,
    projection,
    t,
  });
  const renderRiskNote = () => {
    if (riskBlock) {
      return (
        <Notice tone="danger" title={t("dashboard.borrow.risk_block.title")}>
          {t(`dashboard.borrow.risk_block.${riskBlock}`)}
        </Notice>
      );
    }
    if (riskWarning) {
      return (
        <Notice tone="warning">
          {t("dashboard.borrow.form.validation.ltv")}
        </Notice>
      );
    }
    return (
      <Notice tone="neutral">{t("dashboard.borrow.form.ltv_note")}</Notice>
    );
  };

  return (
    <Stack gap={16}>
      <Text variant="heading" as="h3">
        {t("dashboard.borrow.form.details")}
      </Text>
      <Card padding={16}>
        <DetailList>
          {model.formRows.map((row) => (
            <DetailRow
              key={row.id}
              label={row.label}
              value={row.value}
              tone={row.tone ?? "default"}
              {...(row.meter === undefined ? {} : { meter: row.meter })}
            />
          ))}
        </DetailList>
      </Card>
      {renderRiskNote()}
    </Stack>
  );
};
