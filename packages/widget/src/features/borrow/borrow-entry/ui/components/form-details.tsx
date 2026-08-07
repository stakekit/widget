import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { DetailRow } from "../../../../earn/components";
import type { BorrowMarketWalletBalances } from "../../../action-preparation/model/wallet-balances";
import type { BorrowFormProjection } from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import * as styles from "../styles.css";
import { BorrowInfoNote } from "./notices";

export const BorrowFormDetails = ({
  borrowAmount,
  collateralAmount,
  ltvGreaterThanMax,
  market,
  projection,
  walletBalances,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly ltvGreaterThanMax: boolean;
  readonly market: Market;
  readonly projection: BorrowFormProjection;
  readonly walletBalances: BorrowMarketWalletBalances | null;
}) => {
  const { t } = useTranslation();
  const model = getBorrowDetailsModel({
    balances: walletBalances,
    borrowAmount,
    collateralAmount,
    integration: null,
    market,
    projection,
    t,
  });

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Text variant={{ weight: "bold" }}>
        {t("dashboard.borrow.form.details")}
      </Text>
      <Box className={styles.detailCard}>
        {model.formRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}
      </Box>
      <BorrowInfoNote tone={ltvGreaterThanMax ? "error" : "default"}>
        {ltvGreaterThanMax
          ? t("dashboard.borrow.form.validation.ltv")
          : t("dashboard.borrow.form.ltv_note")}
      </BorrowInfoNote>
    </Box>
  );
};
