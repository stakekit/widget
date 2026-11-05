import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { getActionInputToken } from "../../../../../domain/action/rules";
import { getConfidentialActionKind } from "../../../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import type { Token } from "../../../../../domain/token/token";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  getExitActionTitle,
  getManageActionTitle,
  getPendingActionTitle,
} from "../../../model/action-title";
import type { YieldTransactionFlowIntake } from "../../../model/yield-transaction-flow";
import { useYieldFlowSession } from "../../../react/yield-flow-route";

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
 * token's logo, and the provider running it.
 */
export const useStepsSummary = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveTokenLogo = useTokenLogoResolver();
  const subject = getStepsSubject(t, useYieldFlowSession().intake);
  if (!subject) return null;

  const { action, amount, token, yieldDto } = subject;
  const providerName = yieldDto.provider?.name;

  return {
    title: t("steps.summary", {
      action,
      amount:
        amount === "hidden"
          ? t("shared.confidential.hidden")
          : `${formatTokenAmount(amount, locale, "down")} ${token.symbol}`,
    }),
    ...(providerName ? { detail: t("complete.via", { providerName }) } : {}),
    token: resolveTokenLogo(token, {
      metadata: {
        logoURI: yieldDto.metadata.logoURI,
        name: yieldDto.metadata.name,
        provider: yieldDto.provider,
      },
    }),
  };
};
