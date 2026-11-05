import { useAtomValue } from "@effect/atom-react";
import { capitalize, toLowerCase } from "effect/String";
import { type ReactNode, useId } from "react";
import { Trans, useTranslation } from "react-i18next";
import { isEthenaUsdeStaking } from "../../../../domain/earn/yield";
import type { Token } from "../../../../domain/token/token";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { capitalizeFirstLetters } from "../../../../shared/lib/formatters";
import { formatTransactionHash } from "../../../../shared/lib/general";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import {
  Badge,
  Box,
  Button,
  Card,
  CopyButton,
  DetailList,
  DetailRow,
  Divider,
  ExternalLink,
  Icon,
  IconButton,
  Notice,
  Stack,
  Text,
  TokenAvatar,
} from "../../../../ui/index";
import { useTrackEvent, useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
import {
  formatTransactionTypeLabel,
  useYieldActionContinuationReview,
} from "../../../yield-transaction-flow/index";
import type { YieldActivityItem } from "../../model/activity-action";
import {
  type ActivityActionDetailsProjection,
  projectActivityActionDetails,
} from "../../model/activity-action-details";
import { useActivityActionRoute } from "../../react/activity-action-route";
import { ActivityIcon } from "../activity-page/components/activity-icon";
import { useActivityActionTitle } from "../activity-page/hooks/use-activity-action-title";
import {
  activityStatusLook,
  toActivityStatusCallout,
} from "../components/activity-status";

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
    <Stack gap={12}>
      <PageCtaButton
        cta={{
          disabled: review.disabled,
          hide: false,
          isLoading: review.loading,
          label: t("activity.review.continue"),
          onClick: review.confirm,
        }}
      />
      <Text variant="caption" tone="muted" as="p">
        <Trans
          i18nKey="activity.review.terms_of_use"
          values={{ action: t("activity.review.continue") }}
          components={{
            underline0: (
              <ExternalLink
                href="https://docs.yield.xyz/docs/terms-of-use"
                newTabLabel={t("shared.opens_in_new_tab")}
                onClick={() => trackEvent("termsClicked")}
              >
                {null}
              </ExternalLink>
            ),
          }}
        />
      </Text>
    </Stack>
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
        <Text tone="muted">
          {t("activity.review.transactions_all_confirmed", {
            count: summary.count,
          })}
        </Text>
      );
    case "failed":
      return (
        <Text tone="danger">
          {t("activity.review.transactions_failed", { count: summary.count })}
        </Text>
      );
    case "inProgress":
      return (
        <Text tone="muted">
          {t("activity.review.transactions_in_progress", {
            count: summary.count,
          })}
        </Text>
      );
    case "total":
      return (
        <Text tone="muted" numeric>
          {String(summary.count)}
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
      return <Icon name="CheckCircleIcon" size="sm" tone="success" />;
    case "failed":
      return <Icon name="XIcon" size="sm" tone="danger" />;
    case "skipped":
      return <Icon name="XIcon" size="sm" tone="muted" />;
    case "in_progress":
    case "not_submitted":
      return <Icon name="HistoryIcon" size="sm" tone="muted" />;
  }
};

const statusLabelKey = {
  confirmed: "activity.review.confirmed",
  failed: "steps.failed",
  in_progress: "activity.review.in_progress",
  not_submitted: "activity.review.not_submitted",
  skipped: "steps.skipped",
} as const satisfies Record<ActivityDetailsTransaction["status"], string>;

/**
 * One transaction on one line: its status, its type over when it was sent,
 * then its short hash with copy and explorer buttons. An error follows on
 * its own line.
 */
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
  const errorId = `${id}-error`;
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
  const sentAt =
    transaction.status === "confirmed" ? transaction.broadcastedAt : null;
  const { error, explorerUrl, hash } = transaction;
  // A sent time leaves the status to the icon; otherwise the line says it.
  const describedBy = [
    sentAt === null ? null : statusId,
    detailsId,
    error === null ? null : errorId,
  ]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <Stack
      direction="row"
      align="start"
      gap={12}
      testId="activity-details-transaction"
    >
      {/* On the type's line, whose line box is taller than the icon. */}
      <Box id={statusId} role="img" aria-label={statusLabel} paddingBlock={2}>
        <TransactionStatusIcon status={transaction.status} />
      </Box>
      <Stack gap={4} grow>
        <Stack direction="row" align="center" gap={12}>
          <Stack gap={2} grow>
            <Text truncate>{`${position}. ${type}`}</Text>
            <Text
              id={detailsId}
              variant="caption"
              tone={transaction.status === "failed" ? "danger" : "muted"}
              truncate
            >
              {sentAt ?? statusLabel}
            </Text>
          </Stack>
          {hash ? (
            <Stack direction="row" align="center" gap={4}>
              <Text tone="muted" numeric truncate>
                {formatTransactionHash(hash)}
              </Text>
              <CopyButton
                value={hash}
                label={t("activity.copy_hash")}
                copiedLabel={t("activity.copied")}
              />
            </Stack>
          ) : null}
          {explorerUrl ? (
            <IconButton
              icon="ExternalLinkIcon"
              size="xs"
              label={t("activity.review.view_transaction", { type })}
              aria-describedby={describedBy}
              onClick={() => onOpen(explorerUrl)}
            />
          ) : null}
        </Stack>
        {error === null ? null : (
          <Text id={errorId} variant="caption" tone="danger">
            {error}
          </Text>
        )}
      </Stack>
    </Stack>
  );
};

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
    value ? <DetailRow key={label} label={label} value={value} /> : null
  );
};

const TitleTokenAvatar = ({ token }: { readonly token: Token }) => (
  <TokenAvatar {...useTokenLogo(token)} size="lg" />
);

/**
 * An action's receipt: what happened and its amount, its facts, and the
 * transactions that ran it. On the page it sits under the shell's back
 * button; beside the Activity list it draws its own card.
 */
const Receipt = ({
  children,
  transactionTypeContext,
  view,
}: {
  readonly children?: ReactNode;
  readonly transactionTypeContext: "ETHENA_USDE" | undefined;
  readonly view: ActivityActionDetailsProjection;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const { receiptPlacement } = useActivityActionRoute();
  const title = useActivityActionTitle(view.title);
  const network = capitalizeFirstLetters(view.network.replaceAll("-", " "));
  const statusText = view.statusLabel
    ? t(`activity.status.${view.statusLabel}`)
    : null;
  const headStatus = toActivityStatusCallout(view.statusLabel, statusText);
  const [onlyTransaction, ...otherTransactions] = view.transactions;
  const explorerUrl =
    otherTransactions.length === 0 ? onlyTransaction?.explorerUrl : null;
  // The USD value stands under a token amount; with no token it is the amount.
  const showsTokenAmount = Boolean(view.amount && view.amountTokenSymbol);

  const openTransaction = (url: string) => {
    window.open(url, "_blank");
    trackEvent("viewTxClicked");
  };

  const body = (
    <Stack gap={20}>
      <Stack gap={16}>
        <Stack direction="row" align="center" gap={12}>
          {view.titleToken ? (
            <TitleTokenAvatar token={view.titleToken} />
          ) : (
            <ActivityIcon type="neutral" />
          )}
          <Stack gap={4} align="start" grow>
            <Text variant="title" as="h2">
              {title}
            </Text>
            {headStatus ? (
              <Badge tone={headStatus.tone} icon={headStatus.icon}>
                {headStatus.text}
              </Badge>
            ) : null}
          </Stack>
        </Stack>

        {view.amountText ? (
          <Stack gap={4}>
            <Text variant="display" as="p" breakAnywhere>
              {view.amountText}
            </Text>
            {showsTokenAmount && view.amountFiat ? (
              <Text tone="muted" numeric>
                {view.amountFiat}
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Stack>

      <Divider />
      <DetailList>
        {view.statusLabel && statusText ? (
          <DetailRow
            label={t("activity.details.status")}
            value={statusText}
            tone={activityStatusLook[view.statusLabel].factTone}
          />
        ) : null}
        <DetailRow label={t("activity.details.network")} value={network} />
        {view.providerName ? (
          <DetailRow
            label={t("activity.details.provider")}
            value={view.providerName}
          />
        ) : null}
        {view.validators.length > 0 ? (
          <DetailRow
            label={t("activity.details.validators", {
              count: view.validators.length,
            })}
            value={view.validators.join(", ")}
          />
        ) : null}
        <DetailRow
          label={t("activity.details.created")}
          value={view.createdAt}
        />
        {view.completedAt ? (
          <DetailRow
            label={t("activity.details.completed")}
            value={view.completedAt}
          />
        ) : null}
        {view.canceledAt ? (
          <DetailRow
            label={t("activity.details.canceled")}
            value={view.canceledAt}
          />
        ) : null}
        {view.borrow ? <BorrowReceiptRows borrow={view.borrow} /> : null}
      </DetailList>

      {view.transactions.length > 0 ? (
        <>
          <Divider />
          <Stack gap={12}>
            <Stack direction="row" justify="between" align="center" gap={16}>
              <Text weight="medium">{t("activity.review.transactions")}</Text>
              <TransactionsSummary summary={view.transactionsSummary} />
            </Stack>
            {view.transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                onOpen={openTransaction}
                position={index + 1}
                transaction={transaction}
                typeContext={transactionTypeContext}
              />
            ))}
            {explorerUrl ? (
              <Button
                iconEnd="ExternalLinkIcon"
                onClick={() => openTransaction(explorerUrl)}
                testId="activity-details-explorer"
              >
                {t("activity.details.view_on_explorer")}
              </Button>
            ) : null}
          </Stack>
        </>
      ) : null}

      {children}
    </Stack>
  );

  return receiptPlacement === "pane" ? (
    <Card grow padding={24} testId="activity-details-receipt">
      {body}
    </Card>
  ) : (
    <Stack testId="activity-details-receipt">{body}</Stack>
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
  const { continuationReady } = useActivityActionRoute();
  useTrackPage(reviewPageByIntent[item.actionData.intent]);

  return (
    <Receipt
      transactionTypeContext={
        isEthenaUsdeStaking(item.actionData.yieldId) ? "ETHENA_USDE" : undefined
      }
      view={view}
    >
      {view.continuationUnavailable ? (
        <Notice tone="neutral">
          {t("activity.details.continuation_unavailable")}
        </Notice>
      ) : null}

      {view.canContinue && continuationReady ? <ContinuationControls /> : null}
    </Receipt>
  );
};

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

  // Borrow receipts are not continuation reviews, so they track no review
  // page.
  return item._tag === "yield" ? (
    <YieldReceipt item={item} view={view} />
  ) : (
    <Receipt transactionTypeContext={undefined} view={view} />
  );
};
