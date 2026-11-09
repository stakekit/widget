import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";

import { getKycProviderName } from "../../../../../domain/earn/kyc";
import {
  getYieldOutputAmount,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import {
  formatTokenAmountInUSD,
  getGasFeeInUSD,
} from "../../../../../shared/lib/formatters";
import {
  formatRewardRatePercent,
  formatTokenAmount,
  formatUsd,
  withFigureUnit,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import type { HostHook } from "../../../../../ui/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import type { PageCta } from "../../../../widget-shell/views";
import { formatRewardRateLabel } from "../../../../yield-presentation/index";
import { getYieldFlowAttribution } from "../../../model/attribution";
import {
  useYieldFlowIntake,
  useYieldFlowReview,
} from "../../yield-flow-session";
import type { MetaInfoProps } from "../pages/common.page.tsx";
import type { ReviewFact } from "../pages/review-overview";
import {
  formatReviewDestination,
  getLockupPeriodFact,
  getNetworkFeeWarning,
  getReviewUsdValue,
  getSignaturesFact,
  getUnlockPeriodFact,
  localizeReviewFee,
} from "./review-facts";

const rewardHostHooks = {
  monthly: "estimated-reward__monthly",
  yearly: "estimated-reward__yearly",
} as const satisfies Record<string, HostHook>;

export const useEnterReview = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const enterFlow = useYieldFlowIntake("Enter");
  const facade = useYieldFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const stakeReview = review.stake;
  if (!stakeReview) {
    throw new Error("Enter Review requires an Enter Flow Session.");
  }
  const stakeAmount = stakeReview.stakeAmount;
  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;

  const estimatedRewards = stakeReview.estimatedRewards;
  const yieldType = getYieldTypeLabels(selectedStake, t).review;

  const amount = formatTokenAmount(stakeAmount, locale, "down");
  const previewedUsd = review.action?.amountUsd;
  const amountFiat = previewedUsd?.isGreaterThan(0)
    ? formatUsd(previewedUsd, locale)
    : formatTokenAmountInUSD({
        amount: stakeAmount,
        locale,
        prices: stakeReview.prices,
        token: selectedToken,
      });
  const interestRate = estimatedRewards
    ? formatRewardRatePercent(estimatedRewards.rewardRateAverage, locale)
    : "";

  const rewardsTokenSymbol = stakeReview.rewardsTokenSymbol;
  // Rewards paid in the deposited token carry its fiat value.
  const rewardFact = (
    reward: BigNumber | null | undefined,
    period: "yearly" | "monthly"
  ): ReviewFact => {
    const caption =
      reward && rewardsTokenSymbol === selectedToken.symbol
        ? formatTokenAmountInUSD({
            amount: reward,
            locale,
            prices: stakeReview.prices,
            token: selectedToken,
          })
        : null;
    return {
      label: t(`review.estimated_${period}_rewards`),
      testId: `estimated-reward__${period}`,
      hostHook: rewardHostHooks[period],
      value: withFigureUnit(
        reward ? formatTokenAmount(reward, locale, "nearest") : null,
        rewardsTokenSymbol
      ),
      ...(caption ? { caption } : {}),
    };
  };

  const received = getYieldOutputAmount(selectedStake, stakeAmount);
  const receiveFact: ReviewFact | null = received
    ? {
        label: t("review.you_receive"),
        testId: "review-receive",
        value: `${formatTokenAmount(received.amount, locale, "nearest")} ${received.token.symbol}`,
      }
    : null;

  const facts = [
    ...(interestRate
      ? [
          {
            label: formatRewardRateLabel(selectedStake, t),
            testId: "review-reward-rate",
            value: interestRate,
          },
        ]
      : []),
    ...(estimatedRewards
      ? [
          rewardFact(estimatedRewards.yearly, "yearly"),
          rewardFact(estimatedRewards.monthly, "monthly"),
        ]
      : []),
    receiveFact,
    getLockupPeriodFact(selectedStake, t),
    getUnlockPeriodFact(selectedStake, t),
    getSignaturesFact({
      loading: review.transactionsToSignLoading,
      t,
      transactions: review.transactionsToSign,
    }),
  ].filter((fact): fact is ReviewFact => fact !== null);

  const attribution = getYieldFlowAttribution(enterFlow);
  const destination = formatReviewDestination({
    providerName: attribution?.name,
    t,
    yieldName: selectedStake.metadata.name,
  });

  const fee = getGasFeeInUSD({
    gas: stakeReview.gasAmount,
    locale,
    prices: stakeReview.prices,
    yieldDto: selectedStake,
  });
  const feeWarning = getNetworkFeeWarning({
    feeUsd: getReviewUsdValue({
      amount: stakeReview.gasAmount,
      prices: stakeReview.prices,
      token: selectedStake.mechanics.gasFeeToken,
    }),
    subject: "amount",
    t,
    valueUsd: previewedUsd?.isGreaterThan(0)
      ? previewedUsd
      : getReviewUsdValue({
          amount: stakeAmount,
          prices: stakeReview.prices,
          token: selectedToken,
        }),
  });
  const localizeFee = (
    fee: typeof stakeReview.depositFee,
    type: "deposit" | "management" | "performance"
  ) =>
    localizeReviewFee({
      fee,
      locale,
      prices: stakeReview.prices,
      t,
      token: selectedToken,
      type,
    });
  const depositFee = localizeFee(stakeReview.depositFee, "deposit");
  const managementFee = localizeFee(stakeReview.managementFee, "management");
  const performanceFee = localizeFee(stakeReview.performanceFee, "performance");

  const kycProviderName = getKycProviderName(selectedStake);
  const onKycStatusRefresh = () => refreshKyc(undefined);

  const onClick = () => confirmFlow(undefined);

  const resolveCta = (): PageCta => ({
    disabled: review.confirmDisabled,
    isLoading: review.confirmLoading,
    label: t("shared.confirm"),
    onClick,
  });

  const { earnPresentation } = useWidgetConfig("hostProfile");

  const metaInfo = (
    earnPresentation.zerion
      ? {
          showMetaInfo: true,
          metaInfoProps: {
            selectedStake,
            selectedToken,
            selectedValidators: new Map(enterFlow.selectedValidators),
          },
        }
      : { showMetaInfo: false }
  ) satisfies MetaInfoProps;

  return {
    token: selectedToken,
    amount,
    amountFiat,
    attribution,
    destination,
    facts,
    fee,
    feeWarning,
    yieldType,
    metaInfo,
    isGasCheckWarning: review.isGasCheckWarning,
    gasCheckLoading: review.gasCheckLoading,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: review.actionPreviewLoading,
    commissionFee: null,
    kycGate: review.kyc.gate,
    kycProviderName,
    kycStatusIsChecking: review.kyc.isChecking,
    onKycStatusRefresh,
    cta: resolveCta(),
  };
};
