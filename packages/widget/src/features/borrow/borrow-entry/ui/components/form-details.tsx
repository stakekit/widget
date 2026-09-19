import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import { DetailRow } from "../../../../../shared/ui/components/details-section";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../shared/ui/primitives/warning-box";
import type { BorrowMarketWalletBalances } from "../../../action-preparation/index";
import type { BorrowFormProjection } from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import * as styles from "../styles.css";
import { BorrowInfoNote } from "./notices";

export const BorrowFormDetails = (
  props:
    | { readonly loading: true }
    | {
        readonly loading?: false;
        readonly borrowAmount: BigNumber;
        readonly collateralAmount: BigNumber;
        readonly ltvGreaterThanMax: boolean;
        readonly market: Market;
        readonly projection: BorrowFormProjection;
        readonly walletBalances: BorrowMarketWalletBalances | null;
      }
) => {
  const { t } = useTranslation();
  const model = props.loading
    ? null
    : getBorrowDetailsModel({
        balances: props.walletBalances,
        borrowAmount: props.borrowAmount,
        collateralAmount: props.collateralAmount,
        integration: null,
        market: props.market,
        projection: props.projection,
        t,
      });
  const rows = model?.formRows ?? [
    { id: "max-ltv", label: t("dashboard.borrow.details.max_ltv") },
    {
      id: "collateral-value",
      label: t("dashboard.borrow.form.collateral_value"),
    },
    { id: "loan", label: t("dashboard.borrow.form.loan") },
    { id: "borrow-rate", label: t("dashboard.borrow.form.borrow_rate") },
  ];

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Text variant={{ weight: "bold" }}>
        {t("dashboard.borrow.form.details")}
      </Text>
      <Box className={styles.detailCard}>
        {rows.map((row) => (
          <DetailRow
            key={row.id}
            label={row.label}
            loading={props.loading}
            value={"value" in row ? row.value : null}
          />
        ))}
      </Box>
      {!props.loading && props.ltvGreaterThanMax ? (
        <WarningBox text={t("dashboard.borrow.form.validation.ltv")} />
      ) : (
        <BorrowInfoNote>{t("dashboard.borrow.form.ltv_note")}</BorrowInfoNote>
      )}
    </Box>
  );
};
