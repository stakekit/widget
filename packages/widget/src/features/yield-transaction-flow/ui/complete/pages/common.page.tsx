import { useAtomValue } from "@effect/atom-react";
import { capitalize, toLowerCase } from "effect/String";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type {
  PendingActionLabelContext,
  YieldPendingActionType,
} from "../../../../../domain/action/pending-action";
import type { ConfidentialBatchSide } from "../../../../../domain/earn/confidential";
import {
  type ExtendedYieldType,
  isEthenaUsdeStaking,
} from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { Token } from "../../../../../domain/token/token";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { formatTransactionHash } from "../../../../../shared/lib/general";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { CompleteSummary } from "../../../../../ui/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { formatNextBatchTiming } from "../../../../yield-summary/index";
import { formatTransactionTypeLabel } from "../../../model/yield-transaction-workflow";
import { useComplete } from "../hooks/use-complete.hook";

type CompletePageModel = ReturnType<typeof useComplete>;

/** One row of what the action did, such as what it returned. */
type CompleteRow = NonNullable<
  ComponentProps<typeof CompleteSummary>["rows"]
>[number];

type Props = {
  completion: CompletePageModel;
  amount: string;
  /** The amount's token symbol, after the amount in the title. */
  network: string;
  /**
   * The asset the action was about, as the user knows it, whose logo leads
   * the summary: what an entry deposited, what an exit pays out, what a
   * pending action moved. Without one, the provider's logo does.
   */
  markToken: Token | null;
  pendingActionType?: YieldPendingActionType;
  pendingActionLabelContext?: PendingActionLabelContext | undefined;
  /** The request was queued into this vault's next batch, not settled. */
  batched?: BatchedRequest | null;
  /** What the action returned or will return, such as an exit's token. */
  rows?: ReadonlyArray<CompleteRow>;
  /** What is left to do, such as withdrawing once an exit unlocks. */
  note?: string | null;
  /**
   * What a deposit is projected to earn in a year, such as "+0.05 ETH" with
   * its fiat value: shown with the position it went into.
   */
  yearlyEarnings?: Readonly<{ value: string; caption?: string }> | null;
  yieldType: ExtendedYieldType | null;
  integrationId: YieldId;
};

type BatchedRequest = Readonly<{
  readonly side: ConfidentialBatchSide;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type CompletePageProps = Omit<Props, "completion">;

export const CompletePageComponent = ({
  amount,
  network,
  markToken,
  pendingActionType,
  pendingActionLabelContext,
  batched = null,
  rows = [],
  note = null,
  yieldType,
  yearlyEarnings = null,
  integrationId,
  completion,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const resolveTokenLogo = useTokenLogoResolver();

  const {
    attribution,
    cta,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    positionTotal,
    urls,
    viewPositionCta,
  } = completion;
  const translationOptions = isEthenaUsdeStaking(integrationId)
    ? { context: "ethena_usde" }
    : {};
  const typeContext = isEthenaUsdeStaking(integrationId)
    ? "ETHENA_USDE"
    : undefined;
  const getSuccessKey = () => {
    if (batched?.side === "redemption") {
      return "complete.withdrawal_submitted" as const;
    }
    if (unstakeMatch) return "complete.successfully_unstaked" as const;
    if (pendingActionMatch) {
      return "complete.successfully_pending_action" as const;
    }
    if (batched) return "complete.deposit_submitted" as const;
    return "complete.successfully_staked" as const;
  };
  const successKey = getSuccessKey();

  const getAction = () => {
    if (!yieldType) return "";
    if (unstakeMatch) {
      return t(`complete.unstake.${yieldType}`, translationOptions);
    }
    return t(`complete.stake.${yieldType}`, translationOptions);
  };
  const action = getAction();
  const pendingAction = pendingActionType
    ? {
        pendingAction: t(
          `complete.pending_action.${toLowerCase(pendingActionType)}`,
          pendingActionLabelContext === undefined
            ? translationOptions
            : { context: pendingActionLabelContext }
        ),
      }
    : {};
  const nextBatch = batched
    ? formatNextBatchTiming({
        now: presentationTime?.now ?? null,
        side: batched.side,
        t,
        yieldDto: batched.yieldDto,
      })
    : null;
  const getNextBatchNote = () => {
    if (!nextBatch) return null;
    return nextBatch._tag === "due"
      ? t("complete.next_batch_imminent")
      : t("complete.next_batch_in", { duration: nextBatch.duration });
  };
  const shownNote = getNextBatchNote() ?? note;

  const markLogo = markToken
    ? resolveTokenLogo(markToken, { badge: "none" })
    : null;
  // The position the flow left, once the portfolio holds it, and what a
  // deposit should earn there.
  const positionUsd = positionTotal?.amountUsd.isGreaterThan(0)
    ? formatUsd(positionTotal.amountUsd, locale)
    : null;
  const position =
    positionTotal || yearlyEarnings
      ? {
          heading: t("complete.position.heading"),
          ...(positionTotal
            ? {
                value: `${formatTokenAmount(positionTotal.amount, locale, "down")} ${positionTotal.token.symbol}`,
              }
            : {}),
          ...(positionUsd ? { caption: positionUsd } : {}),
          ...(yearlyEarnings
            ? {
                earnings: {
                  label: t("complete.position.yearly_earnings"),
                  testId: "complete-yearly-earnings",
                  ...yearlyEarnings,
                },
              }
            : {}),
        }
      : null;

  const transactions = urls.map((transaction, index) => {
    const type = capitalize(
      toLowerCase(
        formatTransactionTypeLabel(transaction.type, t, {
          context: typeContext,
        })
      )
    );
    return {
      id: `${index}-${transaction.url}`,
      label: type,
      href: transaction.url,
      viewLabel: t("complete.view_transaction", { type }),
      ...(transaction.hash
        ? { hash: formatTransactionHash(transaction.hash) }
        : {}),
    };
  });

  return (
    <AnimationPage>
      <PageContainer>
        <CompleteSummary
          as="h1"
          mark={{
            name: markLogo?.name ?? network,
            tokenSrc: markLogo?.src,
            providerSrc: attribution?.logo,
          }}
          title={t(successKey, {
            action,
            amount,
            tokenNetwork: network,
            ...pendingAction,
          })}
          {...(attribution
            ? {
                detail: t("complete.via", { providerName: attribution.name }),
                provider: {
                  name: attribution.name,
                  shape: attribution.shape,
                  ...(attribution.logo ? { src: attribution.logo } : {}),
                },
              }
            : {})}
          {...(position ? { position } : {})}
          rows={rows}
          {...(shownNote ? { note: shownNote } : {})}
          transactions={{
            heading: t("complete.transactions"),
            items: transactions,
            newTabLabel: t("shared.opens_in_new_tab"),
            onOpen: onViewTransactionClick,
          }}
        />
        <PageCtaButton
          cta={viewPositionCta ?? cta}
          secondary={
            viewPositionCta && cta ? { ...cta, variant: "secondary" } : null
          }
        />
      </PageContainer>
    </AnimationPage>
  );
};

export const CompletePage = (props: CompletePageProps) => {
  return <CompletePageComponent {...props} completion={useComplete()} />;
};
