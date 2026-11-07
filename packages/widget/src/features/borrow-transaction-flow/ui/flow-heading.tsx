import { useTranslation } from "react-i18next";

import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { Stack, Text } from "../../../ui/index";
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
    <Stack gap={4}>
      <Text variant="title" as="h2">
        {t(title.key, { symbol: title.symbol })}
      </Text>
      <Text tone="muted">
        {`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
      </Text>
    </Stack>
  );
};
