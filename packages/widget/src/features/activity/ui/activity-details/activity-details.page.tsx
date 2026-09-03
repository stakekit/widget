import { useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { capitalizeFirstLetters } from "../../../../shared/lib/formatters";
import { Divider } from "../../../../shared/ui/components/divider";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../shared/ui/primitives/icons/caret-left";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useYieldActionContinuationReview } from "../../../classic-transaction-flow/index";
import { YieldActionContinuationReviewScope } from "../../../classic-transaction-flow/views";
import { useTrackEvent, useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
import {
  type ActivityActionDetailsProjection,
  projectActivityActionDetails,
} from "../../model/activity-action-details";
import { useActivityActionRoute } from "../../react/activity-action-route";
import { ActivityIcon } from "../activity-page/components/activity-icon";
import * as styles from "./styles.css";

const reviewPageByIntent = {
  enter: "stakeReview",
  exit: "unstakeReview",
  manage: "pendingActionReview",
} as const;

const useActivityDetailsTitle = (
  title: ActivityActionDetailsProjection["title"]
) => {
  const { t } = useTranslation();
  return Match.value(title).pipe(
    Match.when({ _tag: "deposited" }, ({ tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.deposited", { token: tokenSymbol })
        : t("activity.item.deposited_without_token")
    ),
    Match.when({ _tag: "withdrew" }, ({ tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.withdrew", { token: tokenSymbol })
        : t("activity.item.withdrew_without_token")
    ),
    Match.when({ _tag: "rewards" }, () => t("activity.item.rewards")),
    Match.when({ _tag: "generic" }, ({ actionLabel, tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.generic", {
            action: actionLabel,
            token: tokenSymbol,
          })
        : t("activity.item.generic_without_token", { action: actionLabel })
    ),
    Match.exhaustive
  );
};

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
                  className={styles.explorerButton}
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
  readonly status: ActivityActionDetailsProjection["statusLabel"];
}) => {
  const { t } = useTranslation();
  const action = status === "action-required";
  return (
    <Box className={action ? styles.badgeAction : styles.badgeMuted}>
      <Text
        variant={{
          size: "small",
          type: action ? "white" : "muted",
          weight: "medium",
        }}
      >
        {t(`activity.status.${status}`)}
      </Text>
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
  const title = useActivityDetailsTitle(view.title);
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
            <StatusBadge status={view.statusLabel} />
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
            <Text variant={{ weight: "medium" }}>
              {t("activity.review.transactions")}
            </Text>
            {view.transactions.map((transaction) => (
              <Box className={styles.transaction} key={transaction.id}>
                <Box className={styles.transactionTop}>
                  <Text variant={{ weight: "normal" }}>
                    {transaction.title}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {capitalizeFirstLetters(
                      transaction.status.replaceAll("_", " ").toLowerCase()
                    )}
                  </Text>
                </Box>
                {transaction.error ? (
                  <Text
                    variant={{
                      type: "danger",
                      weight: "normal",
                      size: "small",
                    }}
                  >
                    {transaction.error}
                  </Text>
                ) : null}
                {transaction.explorerUrl ? (
                  <Box
                    as="button"
                    className={styles.explorerButton}
                    onClick={() =>
                      openTransaction(transaction.explorerUrl ?? "")
                    }
                  >
                    {t("activity.review.view_transaction")}
                  </Box>
                ) : null}
              </Box>
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
