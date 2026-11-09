import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { exactDecimal } from "../../../../../domain/finance/exact";
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
} from "../../../react/yield-flow-route";
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

  // A cancel returns what was committed, its Shares when there are any; one
  // taking an amount shows that amount in the balance's Value Token.
  const returnToken = manageFlow.cancelReturn?.token ?? null;
  const requestAmount = manageFlow.request.arguments?.amount;
  const shown = requestAmount
    ? {
        amount: exactDecimal(requestAmount),
        token: manageFlow.interactedToken,
      }
    : (manageFlow.cancelReturn ?? {
        amount: exactDecimal(0),
        token: manageFlow.interactedToken,
      });
  const amount = shown.amount;
  const interactedToken = shown.token;
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
          // A cancel returns its whole request, unless still encrypted.
          value:
            requestAmount || manageFlow.balanceHidden
              ? returnToken.symbol
              : `${formatTokenAmount(amount, locale, "down")} ${returnToken.symbol}`,
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

  // An encrypted balance has no known amount until it is revealed.
  const formattedAmount = manageFlow.balanceHidden
    ? t("shared.confidential.hidden")
    : formatTokenAmount(amount, locale, "down");
  const amountFiat = manageFlow.balanceHidden
    ? null
    : formatTokenAmountInUSD({
        amount,
        locale,
        prices,
        token: interactedToken,
      });
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
    valueUsd: manageFlow.balanceHidden
      ? null
      : getReviewUsdValue({ amount, prices, token: interactedToken }),
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
