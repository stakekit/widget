import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import type { RiskGateBlockReason } from "../../../../../domain/borrow/risk/risk-gate";
import {
  DetailRow,
  DetailRowList,
} from "../../../../../shared/ui/components/details-section";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../shared/ui/primitives/warning-box";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { BorrowNotice } from "../../../action-feedback/views";
import type { BorrowMarketWalletBalances } from "../../../action-preparation/index";
import type { BorrowFormProjection } from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import * as styles from "../styles.css";
import { BorrowInfoNote } from "./notices";

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
        <BorrowNotice
          tone="error"
          title={t("dashboard.borrow.risk_block.title")}
        >
          {t(`dashboard.borrow.risk_block.${riskBlock}`)}
        </BorrowNotice>
      );
    }
    if (riskWarning) {
      return <WarningBox text={t("dashboard.borrow.form.validation.ltv")} />;
    }
    return (
      <BorrowInfoNote>{t("dashboard.borrow.form.ltv_note")}</BorrowInfoNote>
    );
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Text variant={{ weight: "bold" }}>
        {t("dashboard.borrow.form.details")}
      </Text>
      <Box className={styles.detailCard}>
        <DetailRowList>
          {model.formRows.map((row) => (
            <DetailRow key={row.id} {...row} />
          ))}
        </DetailRowList>
      </Box>
      {renderRiskNote()}
    </Box>
  );
};
