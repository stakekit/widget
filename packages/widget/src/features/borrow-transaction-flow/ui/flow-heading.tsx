import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { Text } from "../../../shared/ui/primitives/typography/text";
import {
  type BorrowTransactionFlowReview,
  getBorrowTransactionFlowTitle,
} from "../model/borrow-transaction-flow";

/** The action and asset, with where it runs beneath. */
export const BorrowFlowHeading = ({
  summary,
}: {
  readonly summary: BorrowTransactionFlowReview["summary"];
}) => {
  const { t } = useTranslation();
  const title = getBorrowTransactionFlowTitle(summary);

  return (
    <>
      <Text variant={{ weight: "bold" }}>
        {t(title.key, { symbol: title.symbol })}
      </Text>
      <Text variant={{ type: "muted", weight: "normal" }}>
        {`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
      </Text>
    </>
  );
};
