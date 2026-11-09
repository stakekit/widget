import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { findYieldToken } from "../../../../../domain/action/rules";
import { getKycProviderName } from "../../../../../domain/earn/kyc";
import { exactDecimal } from "../../../../../domain/finance/exact";
import {
  formatTokenAmountInUSD,
  getGasFeeInUSD,
} from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import { getExitActionTitle } from "../../../model/action-title";
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
  getUnlockPeriodFact,
  localizeReviewFee,
} from "./review-facts";

export const useExitReview = () => {
  const exitFlow = useYieldFlowIntake("Exit");
  const facade = useYieldFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const integrationData = exitFlow.integration;
  const stakeExitTxGas = review.gasAmount;

  const interactedToken = exitFlow.unstakeToken;

  const kycProviderName = getKycProviderName(integrationData);
  const onKycStatusRefresh = () => refreshKyc(undefined);

  const prices = review.prices;

  const amount = exactDecimal(exitFlow.request.arguments?.amount ?? 0);

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveTokenLogo = useTokenLogoResolver();

  const formattedAmount = formatTokenAmount(amount, locale, "down");
  const amountFiat = formatTokenAmountInUSD({
    amount,
    locale,
    prices,
    token: interactedToken,
  });

  const title = getExitActionTitle(t, integrationData);

  const fee = getGasFeeInUSD({
    gas: stakeExitTxGas,
    locale,
    prices,
    yieldDto: integrationData,
  });

  const metaInfo: MetaInfoProps = { showMetaInfo: false };
  const receiveToken = exitFlow.receiveToken
    ? findYieldToken(integrationData, exitFlow.receiveToken.address)
    : undefined;
  const facts = [
    // The amount is in the Exit Unit (ADR 0014); the receive token only
    // names what it is paid out in, so it shows without an amount.
    exitFlow.receiveToken
      ? {
          label: t("position_details.receive_token.label"),
          testId: "review-receive",
          value: exitFlow.receiveToken.symbol,
          ...(receiveToken
            ? { logo: resolveTokenLogo(receiveToken, { badge: "none" }) }
            : {}),
        }
      : null,
    getUnlockPeriodFact(integrationData, t),
    getSignaturesFact({
      loading: review.transactionsToSignLoading,
      t,
      transactions: review.transactionsToSign,
    }),
  ].filter((fact): fact is ReviewFact => fact !== null);
  const attribution = getYieldFlowAttribution(exitFlow);
  const destination = formatReviewDestination({
    providerName: attribution?.name,
    t,
    yieldName: integrationData.metadata.name,
  });
  const feeWarning = getNetworkFeeWarning({
    feeUsd: getReviewUsdValue({
      amount: stakeExitTxGas,
      prices,
      token: integrationData.mechanics.gasFeeToken,
    }),
    subject: "amount",
    t,
    valueUsd: getReviewUsdValue({ amount, prices, token: interactedToken }),
  });
  const withdrawalFee = localizeReviewFee({
    fee: review.withdrawalFee,
    locale,
    prices,
    t,
    token: interactedToken,
    type: "withdrawal",
  });

  const unstakeIsLoading = review.confirmLoading;

  const onClick = () => confirmFlow(undefined);

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: review.confirmDisabled,
    isLoading: unstakeIsLoading,
  });

  return {
    integrationData,
    title,
    amount: formattedAmount,
    amountFiat,
    attribution,
    destination,
    fee,
    feeWarning,
    facts,
    token: interactedToken,
    withdrawalFee,
    metaInfo,
    gasCheckLoading: review.gasCheckLoading,
    isGasCheckWarning: review.isGasCheckWarning,
    kycGate: review.kyc.gate,
    kycProviderName,
    kycStatusIsChecking: review.kyc.isChecking,
    onKycStatusRefresh,
    cta: resolveCta(),
  };
};
