import { useAtomValue } from "@effect/atom-react";
import clsx from "clsx";
import { capitalize, toLowerCase } from "effect/String";
import { useId } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { isEthenaUsdeStaking } from "../../../../domain/earn/yield";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { capitalizeFirstLetters } from "../../../../shared/lib/formatters";
import { formatAddress } from "../../../../shared/lib/general";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { Divider } from "../../../../shared/ui/components/divider";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../shared/ui/primitives/icons/caret-left";
import { CheckCircleIcon } from "../../../../shared/ui/primitives/icons/check-circle";
import { ClockClockWiseIcon } from "../../../../shared/ui/primitives/icons/clock-clock-wise";
import { ExternalLinkIcon } from "../../../../shared/ui/primitives/icons/external-link";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  formatTransactionTypeLabel,
  useYieldActionContinuationReview,
} from "../../../classic-transaction-flow/index";
import { YieldActionContinuationReviewScope } from "../../../classic-transaction-flow/views";
import { useTrackEvent, useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
import {
  type ActivityActionDetailsProjection,
  projectActivityActionDetails,
} from "../../model/activity-action-details";
import { useActivityActionRoute } from "../../react/activity-action-route";
import { ActivityIcon } from "../activity-page/components/activity-icon";
import { useActivityActionTitle } from "../activity-page/hooks/use-activity-action-title";
import * as styles from "./styles.css";

const reviewPageByIntent = {
  enter: "stakeReview",
  exit: "unstakeReview",
  manage: "pendingActionReview",
} as const;

const ContinuationControls = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const review = useYieldActionContinuationReview();

  return (
    <>
      <PageCtaButton
        cta={{
          disabled: review.disabled,
          hide: false,
          isLoading: review.loading,
          label: t("activity.review.continue"),
          onClick: review.confirm,
        }}
      />
      <Box paddingTop="3">
        <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
          <Trans
            i18nKey="activity.review.terms_of_use"
            values={{ action: t("activity.review.continue") }}
            components={{
              underline0: (
                // biome-ignore lint: third-party terms link
                <a
                  className={styles.termsLink}
                  href="https://docs.yield.xyz/docs/terms-of-use"
                  onClick={() => trackEvent("termsClicked")}
                  rel="noreferrer"
                  target="_blank"
                />
              ),
            }}
          />
        </Text>
      </Box>
    </>
  );
};

const StatusBadge = ({
  status,
}: {
  readonly status: NonNullable<ActivityActionDetailsProjection["statusLabel"]>;
}) => {
  const { t } = useTranslation();
  return (
    <Box className={styles.badgeMuted}>
      <Text variant={{ size: "small", type: "muted", weight: "medium" }}>
        {t(`activity.status.${status}`)}
      </Text>
    </Box>
  );
};

const TransactionsSummary = ({
  summary,
}: {
  readonly summary: ActivityActionDetailsProjection["transactionsSummary"];
}) => {
  const { t } = useTranslation();

  switch (summary._tag) {
    case "allConfirmed":
      return (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("activity.review.transactions_all_confirmed", {
            count: summary.count,
          })}
        </Text>
      );
    case "failed":
      return (
        <Text variant={{ type: "danger", weight: "normal" }}>
          {t("activity.review.transactions_failed", { count: summary.count })}
        </Text>
      );
    case "inProgress":
      return (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("activity.review.transactions_in_progress", {
            count: summary.count,
          })}
        </Text>
      );
    case "total":
      return (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {summary.count}
        </Text>
      );
  }
};

type ActivityDetailsTransaction =
  ActivityActionDetailsProjection["transactions"][number];

const TransactionStatusIcon = ({
  status,
}: {
  readonly status: ActivityDetailsTransaction["status"];
}) => {
  switch (status) {
    case "confirmed":
      return <CheckCircleIcon color={vars.color.statusSuccess} />;
    case "failed":
      return <XIcon color="textDanger" hw={16} strokeWidth={2.5} />;
    case "skipped":
      return <XIcon color="textMuted" hw={16} strokeWidth={2.5} />;
    case "in_progress":
    case "not_submitted":
      return <ClockClockWiseIcon />;
  }
};

const statusLabelKey = {
  confirmed: "activity.review.confirmed",
  failed: "steps.failed",
  in_progress: "activity.review.in_progress",
  not_submitted: "activity.review.not_submitted",
  skipped: "steps.skipped",
} as const satisfies Record<ActivityDetailsTransaction["status"], string>;

const TransactionRow = ({
  onOpen,
  position,
  transaction,
  typeContext,
}: {
  readonly onOpen: (url: string) => void;
  readonly position: number;
  readonly transaction: ActivityDetailsTransaction;
  readonly typeContext: "ETHENA_USDE" | undefined;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const statusId = `${id}-status`;
  const detailsId = `${id}-details`;
  const type = capitalize(
    toLowerCase(
      formatTransactionTypeLabel(transaction.type, t, { context: typeContext })
    )
  );
  const statusLabel = t(statusLabelKey[transaction.status]);
  const details = [
    transaction.status === "confirmed"
      ? (transaction.broadcastedAt ?? statusLabel)
      : statusLabel,
    transaction.error,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const content = (
    <>
      <Box aria-label={statusLabel} display="flex" id={statusId} role="img">
        <TransactionStatusIcon status={transaction.status} />
      </Box>
      <Box className={styles.transactionText}>
        <Text variant={{ weight: "normal" }}>{`${position}. ${type}`}</Text>
        <Text
          id={detailsId}
          variant={{
            size: "small",
            type:
              transaction.status === "failed" || transaction.error
                ? "danger"
                : "muted",
            weight: "normal",
          }}
        >
          {details}
        </Text>
      </Box>
      {transaction.explorerUrl ? (
        <Box className={styles.transactionExplorer}>
          {transaction.hash ? (
            <Text variant={{ type: "muted", weight: "normal" }}>
              {formatAddress(transaction.hash, {
                leadingChars: 6,
                trailingChars: 4,
              })}
            </Text>
          ) : null}
          <ExternalLinkIcon />
        </Box>
      ) : null}
    </>
  );
  const { explorerUrl } = transaction;

  return explorerUrl ? (
    <Box
      aria-describedby={`${statusId} ${detailsId}`}
      aria-label={t("activity.review.view_transaction", { type })}
      as="button"
      className={clsx(styles.transaction, styles.transactionLink)}
      data-rk="activity-details-transaction"
      onClick={() => onOpen(explorerUrl)}
      type="button"
    >
      {content}
    </Box>
  ) : (
    <Box className={styles.transaction} data-rk="activity-details-transaction">
      {content}
    </Box>
  );
};

const Receipt = ({
  view,
}: {
  readonly view: ActivityActionDetailsProjection;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const { continuationReady, item, presentation, providersDetails } =
    useActivityActionRoute();
  const navigate = useNavigate();
  const title = useActivityActionTitle(view.title);
  const firstProvider = providersDetails[0];
  const providerName = firstProvider?.name ?? firstProvider?.address ?? null;
  const token = item.yieldData?.token ?? null;
  useTrackPage(reviewPageByIntent[item.actionData.intent]);

  const openTransaction = (url: string) => {
    window.open(url, "_blank");
    trackEvent("viewTxClicked");
  };

  return (
    <Box className={styles.page} data-rk="activity-details-receipt">
      {presentation === "Classic" ? (
        <Box
          as="button"
          aria-label={t("activity.details.back")}
          className={styles.back}
          onClick={() => navigate("/activity")}
        >
          <CaretLeftIcon />
        </Box>
      ) : null}

      <Box className={styles.header}>
        {token ? (
          <TokenIcon token={token} tokenLogoHw="12" />
        ) : (
          <ActivityIcon type="neutral" />
        )}
        <Box
          className={styles.heading}
          display="flex"
          flexDirection="column"
          gap="1"
        >
          <Box alignItems="center" display="flex" flexWrap="wrap" gap="2">
            <Text variant={{ size: "large", weight: "bold" }}>{title}</Text>
            {view.statusLabel ? (
              <StatusBadge status={view.statusLabel} />
            ) : null}
          </Box>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {providerName
              ? t("activity.details.via_network", {
                  network: capitalizeFirstLetters(
                    view.network.replaceAll("-", " ")
                  ),
                  provider: providerName,
                })
              : capitalizeFirstLetters(view.network.replaceAll("-", " "))}
          </Text>
        </Box>
      </Box>

      {view.amount ? (
        <Text className={styles.amount} variant={{ weight: "medium" }}>
          {view.amount}
          {view.tokenSymbol ? ` ${view.tokenSymbol}` : ""}
        </Text>
      ) : null}

      <Divider />
      <Box className={styles.rows}>
        <Box className={styles.row}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("activity.details.created")}
          </Text>
          <Text className={styles.rowValue} variant={{ weight: "normal" }}>
            {view.createdAt}
          </Text>
        </Box>
        {view.completedAt ? (
          <Box className={styles.row}>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("activity.details.completed")}
            </Text>
            <Text className={styles.rowValue} variant={{ weight: "normal" }}>
              {view.completedAt}
            </Text>
          </Box>
        ) : null}
      </Box>

      {view.transactions.length > 0 ? (
        <>
          <Divider />
          <Box className={styles.transactions}>
            <Box className={styles.transactionsHeader}>
              <Text variant={{ weight: "medium" }}>
                {t("activity.review.transactions")}
              </Text>
              <TransactionsSummary summary={view.transactionsSummary} />
            </Box>
            {view.transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                onOpen={openTransaction}
                position={index + 1}
                transaction={transaction}
                typeContext={
                  isEthenaUsdeStaking(item.actionData.yieldId)
                    ? "ETHENA_USDE"
                    : undefined
                }
              />
            ))}
          </Box>
        </>
      ) : null}

      {view.continuationUnavailable ? (
        <Text
          className={styles.unavailable}
          variant={{ type: "muted", weight: "normal" }}
        >
          {t("activity.details.continuation_unavailable")}
        </Text>
      ) : null}

      {view.canContinue && continuationReady ? (
        <YieldActionContinuationReviewScope>
          <ContinuationControls />
        </YieldActionContinuationReviewScope>
      ) : null}
    </Box>
  );
};

export const ActivityDetailsPage = () => {
  const { i18n } = useTranslation();
  const { item } = useActivityActionRoute();
  const presentationTime = useAtomValue(presentationClockAtom);
  if (!presentationTime) return null;

  return (
    <Receipt
      view={projectActivityActionDetails({
        item,
        locale: i18n.language,
        presentationTime,
      })}
    />
  );
};
