import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { getKycProviderName } from "../../../../../domain/earn/kyc";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import {
  getFeesInUSD,
  getGasFeeInUSD,
} from "../../../../../shared/lib/formatters";
import {
  formatExactPercent,
  formatRewardRatePercent,
  formatTokenAmount,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import {
  useClassicFlowIntake,
  useClassicFlowReview,
} from "../../../react/classic-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page.tsx";

export const useStakeReview = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const enterFlow = useClassicFlowIntake("Enter");
  const facade = useClassicFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const stakeReview = review.stake;
  if (!stakeReview) {
    throw new Error("Stake Review requires an Enter Flow Session.");
  }
  const stakeAmount = stakeReview.stakeAmount;
  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;

  const rewardToken = stakeReview.rewardToken;
  const estimatedRewards = stakeReview.estimatedRewards;
  const yieldType = getYieldTypeLabels(selectedStake, t).review;

  const amount = formatTokenAmount(stakeAmount, locale, "down");
  const interestRate = estimatedRewards
    ? formatRewardRatePercent(estimatedRewards.rewardRateAverage, locale)
    : "";

  const rewardsTokenSymbol = stakeReview.rewardsTokenSymbol;

  const estimatedRewardAmounts = estimatedRewards
    ? {
        earnYearly: `${estimatedRewards.yearly ? formatTokenAmount(estimatedRewards.yearly, locale, "nearest") : "-"} ${rewardsTokenSymbol}`,
        earnMonthly: `${estimatedRewards.monthly ? formatTokenAmount(estimatedRewards.monthly, locale, "nearest") : "-"} ${rewardsTokenSymbol}`,
      }
    : null;

  const fee = getGasFeeInUSD({
    gas: stakeReview.gasAmount,
    locale,
    prices: stakeReview.prices,
    yieldDto: selectedStake,
  });
  const localizeFee = (
    value: typeof stakeReview.depositFee,
    type: "deposit" | "management" | "performance"
  ) =>
    value
      ? {
          inPercentage: formatExactPercent(value.ratio, locale),
          inUSD: getFeesInUSD({
            amount: value.amount,
            locale,
            prices: stakeReview.prices,
            token: selectedToken,
          }),
          explanation: t(`review.${type}_fee_explanation`),
          label: t(`review.${type}_fee`),
        }
      : null;
  const depositFee = localizeFee(stakeReview.depositFee, "deposit");
  const managementFee = localizeFee(stakeReview.managementFee, "management");
  const performanceFee = localizeFee(stakeReview.performanceFee, "performance");

  const metadata = {
    logoURI: selectedStake.metadata.logoURI,
    name: selectedStake.metadata.name,
    provider: selectedStake.provider,
  };
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
    fee,
    interestRate,
    estimatedRewardAmounts,
    yieldType,
    rewardToken,
    metadata,
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
