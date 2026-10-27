import { useAtomValue } from "@effect/atom-react";
import clsx from "clsx";
import { capitalize, toLowerCase } from "effect/String";
import { type ReactNode, useId } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { isEthenaUsdeStaking } from "../../../../domain/earn/yield";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { borrowTokenToAppToken } from "../../../../shared/lib/borrow-token";
import {
  capitalizeFirstLetters,
  formatBorrowProviderName,
} from "../../../../shared/lib/formatters";
import { formatAddress } from "../../../../shared/lib/general";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { Divider } from "../../../../shared/ui/components/divider";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import type { TokenIconProps } from "../../../../shared/ui/components/token-icon/props";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../shared/ui/primitives/icons/caret-left";
import { CheckCircleIcon } from "../../../../shared/ui/primitives/icons/check-circle";
import { ClockClockWiseIcon } from "../../../../shared/ui/primitives/icons/clock-clock-wise";
import { ExternalLinkIcon } from "../../../../shared/ui/primitives/icons/external-link";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackEvent, useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
import {
  formatTransactionTypeLabel,
  useYieldActionContinuationReview,
} from "../../../yield-transaction-flow/index";
import type {
  BorrowActivityItem,
  YieldActivityItem,
} from "../../model/activity-action";
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
      transaction._tag === "borrow"
        ? t(`dashboard.borrow.execution_page.tx_type.${transaction.type}`)
        : formatTransactionTypeLabel(transaction.type, t, {
            context: typeContext,
          })
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

const ReceiptRow = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <Box className={styles.row}>
    <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
    <Text className={styles.rowValue} variant={{ weight: "normal" }}>
      {value}
    </Text>
  </Box>
);

const BorrowReceiptRows = ({
  borrow,
}: {
  readonly borrow: NonNullable<ActivityActionDetailsProjection["borrow"]>;
}) => {
  const { t } = useTranslation();
  const rows = [
    { label: t("activity.details.market"), value: borrow.market },
    {
      label: t("activity.details.origination_fee"),
      value: borrow.originationFee,
    },
    {
      label: t("activity.details.collateral_fee"),
      value: borrow.collateralFee,
    },
    { label: t("activity.details.ltv"), value: borrow.ltv },
    { label: t("activity.details.health_factor"), value: borrow.healthFactor },
  ];

  return rows.map(({ label, value }) =>
    value ? <ReceiptRow key={label} label={label} value={value} /> : null
  );
};

const Receipt = ({
  children,
  providerName,
  token,
  transactionTypeContext,
  view,
}: {
  readonly children?: ReactNode;
  readonly providerName: string | null;
  readonly token: TokenIconProps["token"] | null;
  readonly transactionTypeContext: "ETHENA_USDE" | undefined;
  readonly view: ActivityActionDetailsProjection;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const { showsBackButton } = useActivityActionRoute();
  const navigate = useNavigate();
  const title = useActivityActionTitle(view.title);
  const network = capitalizeFirstLetters(view.network.replaceAll("-", " "));

  const openTransaction = (url: string) => {
    window.open(url, "_blank");
    trackEvent("viewTxClicked");
  };

  return (
    <Box className={styles.page} data-rk="activity-details-receipt">
      {showsBackButton ? (
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
                  network,
                  provider: providerName,
                })
              : network}
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
        <ReceiptRow
          label={t("activity.details.created")}
          value={view.createdAt}
        />
        {view.completedAt ? (
          <ReceiptRow
            label={t("activity.details.completed")}
            value={view.completedAt}
          />
        ) : null}
        {view.borrow ? <BorrowReceiptRows borrow={view.borrow} /> : null}
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
                typeContext={transactionTypeContext}
              />
            ))}
          </Box>
        </>
      ) : null}

      {children}
    </Box>
  );
};

const YieldReceipt = ({
  item,
  view,
}: {
  readonly item: YieldActivityItem;
  readonly view: ActivityActionDetailsProjection;
}) => {
  const { t } = useTranslation();
  const { continuationReady, providersDetails } = useActivityActionRoute();
  const firstProvider = providersDetails[0];
  useTrackPage(reviewPageByIntent[item.actionData.intent]);

  return (
    <Receipt
      providerName={firstProvider?.name ?? firstProvider?.address ?? null}
      token={item.yieldData?.token ?? null}
      transactionTypeContext={
        isEthenaUsdeStaking(item.actionData.yieldId) ? "ETHENA_USDE" : undefined
      }
      view={view}
    >
      {view.continuationUnavailable ? (
        <Text
          className={styles.unavailable}
          variant={{ type: "muted", weight: "normal" }}
        >
          {t("activity.details.continuation_unavailable")}
        </Text>
      ) : null}

      {view.canContinue && continuationReady ? <ContinuationControls /> : null}
    </Receipt>
  );
};

// Borrow receipts are not continuation reviews, so they track no review page.
const BorrowReceipt = ({
  item,
  view,
}: {
  readonly item: BorrowActivityItem;
  readonly view: ActivityActionDetailsProjection;
}) => (
  <Receipt
    providerName={
      item.integration ? formatBorrowProviderName(item.integration.name) : null
    }
    token={
      item.token
        ? borrowTokenToAppToken({ network: item.network, token: item.token })
        : null
    }
    transactionTypeContext={undefined}
    view={view}
  />
);

export const ActivityDetailsPage = () => {
  const { i18n } = useTranslation();
  const { item } = useActivityActionRoute();
  const presentationTime = useAtomValue(presentationClockAtom);
  if (!presentationTime) return null;

  const view = projectActivityActionDetails({
    item,
    locale: i18n.language,
    presentationTime,
  });

  return item._tag === "yield" ? (
    <YieldReceipt item={item} view={view} />
  ) : (
    <BorrowReceipt item={item} view={view} />
  );
};
