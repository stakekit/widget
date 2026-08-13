import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { getKycProviderName } from "../../../../../domain/earn/kyc";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import type { PageCta } from "../../../../widget-shell/components";
import {
  useClassicFlowIntake,
  useClassicFlowReview,
} from "../../../react/classic-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page.tsx";

export const useStakeReview = () => {
  const { t } = useTranslation();
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

  const amount = useMemo(
    () => defaultFormattedNumber(stakeAmount),
    [stakeAmount]
  );
  const interestRate = useMemo(
    () => estimatedRewards?.percentage.toString() ?? "",
    [estimatedRewards]
  );

  const rewardsTokenSymbol = stakeReview.rewardsTokenSymbol;

  const estimatedRewardAmounts = useMemo(
    () =>
      estimatedRewards
        ? {
            earnYearly: `${estimatedRewards.yearly} ${rewardsTokenSymbol}`,
            earnMonthly: `${estimatedRewards.monthly} ${rewardsTokenSymbol}`,
          }
        : null,
    [estimatedRewards, rewardsTokenSymbol]
  );

  const fee = stakeReview.gasFee;
  const localizeFee = (
    value: typeof stakeReview.depositFee,
    type: "deposit" | "management" | "performance"
  ) =>
    value
      ? {
          ...value,
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

  const variant = useWidgetConfig("variant");

  const metaInfo = useMemo(
    () =>
      (variant === "zerion"
        ? {
            showMetaInfo: true,
            metaInfoProps: {
              selectedStake,
              selectedToken,
              selectedValidators: new Map(enterFlow.selectedValidators),
            },
          }
        : { showMetaInfo: false }) satisfies MetaInfoProps,
    [selectedStake, selectedToken, enterFlow.selectedValidators, variant]
  );

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
