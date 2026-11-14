import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  formatTokenAmountInUSD,
  getGasFeeInUSD,
} from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import { getManageActionTitle } from "../../../model/action-title";
import { getYieldFlowAttribution } from "../../../model/attribution";
import {
  useYieldFlowIntake,
  useYieldFlowReview,
} from "../../yield-flow-session";
import type { MetaInfoProps } from "../pages/common.page.tsx";
import type { ReviewFact } from "../pages/review-overview";
import {
  formatReviewDestination,
  getNetworkFeeWarning,
  getReviewUsdValue,
  getSignaturesFact,
} from "./review-facts";

export const usePendingActionReview = () => {
  const manageFlow = useYieldFlowIntake("Manage");
  const facade = useYieldFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const review = useAtomValue(facade.reviewViewAtom);
  const pendingTxGas = review.gasAmount;

  // A cancel names what it returns; an action without an amount shows none.
  const returnToken = manageFlow.cancelReturnToken ?? null;
  const shown = manageFlow.balanceHidden ? null : manageFlow.amount;
  const interactedToken =
    manageFlow.amount?.token ?? manageFlow.interactedToken;
  const integrationData = manageFlow.integration;

  const prices = review.prices;

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const title = getManageActionTitle(t, {
    balanceType: manageFlow.balanceType,
    type: manageFlow.request.action,
    yieldDto: integrationData,
  });

  const fee = getGasFeeInUSD({
    gas: pendingTxGas,
    locale,
    prices,
    yieldDto: integrationData,
  });

  const onClick = () => confirmFlow(undefined);

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: review.confirmDisabled,
    isLoading: review.confirmLoading,
  });

  const metaInfo: MetaInfoProps = { showMetaInfo: false };
  const resolveTokenLogo = useTokenLogoResolver();
  const facts = [
    returnToken
      ? {
          label: t("review.you_receive"),
          testId: "review-receive",
          // Its amount, when it has one, heads the review.
          value: returnToken.symbol,
          logo: resolveTokenLogo(returnToken, { badge: "none" }),
        }
      : null,
    getSignaturesFact({
      loading: review.transactionsToSignLoading,
      t,
      transactions: review.transactionsToSign,
    }),
  ].filter((fact): fact is ReviewFact => fact !== null);
  const attribution = getYieldFlowAttribution(manageFlow);
  const destination = formatReviewDestination({
    providerName: attribution?.name,
    t,
    yieldName: integrationData.metadata.name,
  });

  // An encrypted balance's amount is unknown until it is revealed; an
  // action without an amount names its token alone.
  const getFormattedAmount = () => {
    if (!manageFlow.amount) return null;
    if (manageFlow.balanceHidden) return t("shared.confidential.hidden");
    return formatTokenAmount(manageFlow.amount.amount, locale, "down");
  };
  const formattedAmount = getFormattedAmount();
  const amountFiat = shown
    ? formatTokenAmountInUSD({
        amount: shown.amount,
        locale,
        prices,
        token: interactedToken,
      })
    : null;
  // Claiming rewards the network fee eats is worth a warning.
  const feeWarning = getNetworkFeeWarning({
    feeUsd: getReviewUsdValue({
      amount: pendingTxGas,
      prices,
      token: integrationData.mechanics.gasFeeToken,
    }),
    subject:
      manageFlow.pendingActionType === "CLAIM_REWARDS" ? "rewards" : "amount",
    t,
    valueUsd: shown
      ? getReviewUsdValue({
          amount: shown.amount,
          prices,
          token: interactedToken,
        })
      : null,
  });

  return {
    integrationData,
    title,
    amount: formattedAmount,
    amountFiat,
    attribution,
    destination,
    facts,
    fee,
    feeWarning,
    token: interactedToken,
    metaInfo,
    isGasCheckWarning: review.isGasCheckWarning,
    gasCheckLoading: review.gasCheckLoading,
    cta: resolveCta(),
  };
};
