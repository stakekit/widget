import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import type { PositionBalanceRow } from "../../../../../domain/portfolio/positions";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { DetailRow } from "../../../../../shared/ui/components/details-section";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import {
  getPendingBalanceBatchDetails,
  type PendingBalanceBatchDetails,
} from "../../../model/pending-balance-batch";

const BatchLink = ({
  link,
}: {
  readonly link: PendingBalanceBatchDetails["batcher"];
}) => (
  <a href={link.url} rel="noreferrer" target="_blank">
    <Text as="span" variant={{ weight: "normal" }}>
      {link.label} ↗
    </Text>
  </a>
);

export const PendingBatchDetails = ({
  balance,
}: {
  readonly balance: PositionBalanceRow;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const details = presentationTime
    ? getPendingBalanceBatchDetails({
        balance,
        locale,
        t,
        timeZone: presentationTime.timeZone,
      })
    : null;
  if (!details) return null;

  return (
    <Box
      data-testid="position-details-pending-batch"
      display="flex"
      flexDirection="column"
      gap="1"
    >
      <Text variant={{ weight: "bold" }}>{details.title}</Text>
      <DetailRow
        label={details.requestsLabel}
        value={
          <Box display="flex" flexDirection="column" alignItems="flex-end">
            {details.requests.map((request) => (
              <BatchLink key={request.key} link={request} />
            ))}
          </Box>
        }
      />
      <DetailRow
        label={t("position_details.batch.batcher")}
        value={<BatchLink link={details.batcher} />}
      />
      {balance.date ? (
        <Text variant={{ type: "muted", size: "small" }}>
          {t("position_details.batch.cancel_returns", {
            symbol: balance.token.symbol,
          })}
        </Text>
      ) : null}
    </Box>
  );
};
