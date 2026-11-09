import { useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { getActionInputToken } from "../../../../../domain/action/rules";
import { getConfidentialActionKind } from "../../../../../domain/earn/confidential";
import {
  getYieldOutputAmount,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../../../domain/finance/exact";
import type { Token } from "../../../../../domain/token/token";
import {
  formatTokenAmountInUSD,
  getGasFeeInUSD,
} from "../../../../../shared/lib/formatters";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import type { TransactionStepsDetail } from "../../../../transaction-steps/views";
import {
  getExitActionTitle,
  getManageActionTitle,
  getPendingActionTitle,
} from "../../../model/action-title";
import { getYieldFlowAttribution } from "../../../model/attribution";
import type { YieldTransactionFlowIntake } from "../../../model/intake";
import {
  useYieldFlowExecution,
  useYieldFlowSession,
} from "../../../react/yield-flow-route";
import { formatReviewDestination } from "../../review/hooks/review-facts";

type ContinuationIntake = Extract<
  YieldTransactionFlowIntake,
  { readonly _tag: "YieldActionContinuation" }
>;

/** What the Steps run, as Review showed it: the action, amount and token. */
type StepsSubject = Readonly<{
  readonly action: string;
  /** Unknown while the balance is encrypted. */
  readonly amount: BigNumber | "hidden";
  readonly token: Token;
  readonly yieldDto: EarnYieldWithProvider;
}>;

const getContinuationAction = (
  t: TFunction,
  { action, selectedYield }: ContinuationIntake
) => {
  switch (action.intent) {
    case "enter":
      return getYieldTypeLabels(selectedYield, t).review;
    case "exit":
      return getExitActionTitle(t, selectedYield);
    case "manage":
      // The continued action carries no balance: of the label contexts, only
      // a confidential payout follows from the action itself.
      return getPendingActionTitle(
        t,
        action.type,
        getConfidentialActionKind(selectedYield, action) === "instantExitPayout"
          ? "instant_withdrawal"
          : undefined
      );
  }
};

const getStepsSubject = (
  t: TFunction,
  intake: YieldTransactionFlowIntake
): StepsSubject | null => {
  switch (intake._tag) {
    case "Enter":
      return {
        action: getYieldTypeLabels(intake.selectedStake, t).review,
        amount: exactDecimal(intake.request.arguments?.amount ?? 0),
        token: intake.selectedToken,
        yieldDto: intake.selectedStake,
      };
    case "Exit":
      return {
        action: getExitActionTitle(t, intake.integration),
        amount: exactDecimal(intake.request.arguments?.amount ?? 0),
        token: intake.unstakeToken,
        yieldDto: intake.integration,
      };
    case "Manage": {
      // As Review: an entered amount in the balance's Value Token; without
      // one, what a cancel returns.
      const requestAmount = intake.request.arguments?.amount;
      const shown = requestAmount
        ? { amount: exactDecimal(requestAmount), token: intake.interactedToken }
        : (intake.cancelReturn ?? {
            amount: exactDecimal(0),
            token: intake.interactedToken,
          });
      return {
        action: getManageActionTitle(t, {
          balanceType: intake.balanceType,
          type: intake.request.action,
          yieldDto: intake.integration,
        }),
        amount: intake.balanceHidden ? "hidden" : shown.amount,
        token: shown.token,
        yieldDto: intake.integration,
      };
    }
    case "YieldActionContinuation": {
      const { action, selectedYield } = intake;
      const token = getActionInputToken({
        actionDto: action,
        yieldDto: selectedYield,
      });
      if (!token) return null;
      return {
        action: getContinuationAction(t, intake),
        amount: action.amount ?? exactDecimal(0),
        token,
        yieldDto: selectedYield,
      };
    }
  }
};

/**
 * The summary heading the Steps: the action with its amount and token, the
 * logo of that token (the one sent, not the yield's), travelling in from
 * Review, and who runs it with their logo, as Review named them.
 */
export const useStepsSummary = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveTokenLogo = useTokenLogoResolver();
  const { intake } = useYieldFlowSession();
  const subject = getStepsSubject(t, intake);
  if (!subject) return null;

  const { action, amount, token } = subject;
  const attribution = getYieldFlowAttribution(intake);

  return {
    title: t("steps.summary", {
      action,
      amount:
        amount === "hidden"
          ? t("shared.confidential.hidden")
          : `${formatTokenAmount(amount, locale, "down")} ${token.symbol}`,
    }),
    ...(attribution
      ? {
          detail: t("complete.via", { providerName: attribution.name }),
          provider: {
            name: attribution.name,
            shape: attribution.shape,
            ...(attribution.logo ? { src: attribution.logo } : {}),
          },
        }
      : {}),
    token: resolveTokenLogo(token),
  };
};

/**
 * What the Steps run, as Review showed it, under them: the amount and its
 * fiat value, the yield and its provider, the estimated gas, and what an
 * entry returns. A part not known here is left out.
 */
export const useStepsDetails = (): ReadonlyArray<TransactionStepsDetail> => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const { intake } = useYieldFlowSession();
  const { amountUsd, gasAmount, prices } = useAtomValue(
    useYieldFlowExecution().pricingViewAtom
  );
  const subject = getStepsSubject(t, intake);
  if (!subject) return [];

  const { amount, token, yieldDto } = subject;
  // A hidden amount shows no value of it either.
  const shown = amount === "hidden" ? null : amount;
  const fiat =
    shown &&
    (amountUsd?.isGreaterThan(0)
      ? formatUsd(amountUsd, locale)
      : formatTokenAmountInUSD({ amount: shown, locale, prices, token }));
  const gas = getGasFeeInUSD({ gas: gasAmount, locale, prices, yieldDto });
  const received =
    intake._tag === "Enter" && shown
      ? getYieldOutputAmount(yieldDto, shown)
      : null;

  return [
    {
      label: t("steps.details.amount"),
      testId: "steps-details-amount",
      value: shown
        ? `${formatTokenAmount(shown, locale, "down")} ${token.symbol}`
        : t("shared.confidential.hidden"),
      ...(fiat ? { caption: fiat } : {}),
    },
    {
      label: t("steps.details.yield"),
      testId: "steps-details-yield",
      logo: {
        name: yieldDto.metadata.name,
        src: yieldDto.metadata.logoURI ?? undefined,
      },
      value: formatReviewDestination({
        providerName: getYieldFlowAttribution(intake)?.name,
        t,
        yieldName: yieldDto.metadata.name,
      }),
    },
    ...(gas
      ? [
          {
            label: t("steps.details.gas"),
            testId: "steps-details-gas",
            value: gas,
          },
        ]
      : []),
    ...(received
      ? [
          {
            label: t("steps.details.receive"),
            testId: "steps-details-receive",
            value: `${formatTokenAmount(received.amount, locale, "nearest")} ${received.token.symbol}`,
          },
        ]
      : []),
  ];
};
