import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { getActionProviderYieldId } from "../../../../../domain/types/action";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import { isBittensorStaking } from "../../../../../domain/types/yields";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useEstimatedRewards } from "../../../../earn/react/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../../earn/react/use-reward-token-details";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useClassicFlowSessionFacade } from "../../../react/classic-flow-session-context";
import { useRequiredEnterClassicTransactionFlow } from "../../../react/request-route-guards";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterFlow = useRequiredEnterClassicTransactionFlow();
  const facade = useClassicFlowSessionFacade();
  useAtomMount(facade.reviewRouteAtom);
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const stakeAmount = useMemo(
    () => new BigNumber(enterFlow.request.arguments?.amount ?? 0),
    [enterFlow.request]
  );

  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;
  const stakeEnterTxGas = review.gasAmount;

  const selectedProviderYieldId = getActionProviderYieldId(enterFlow.request);

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators: new Map(enterFlow.selectedValidators),
    selectedProviderYieldId,
  });
  const yieldType = useYieldType(selectedStake)?.review ?? "";

  const amount = useMemo(
    () => defaultFormattedNumber(stakeAmount),
    [stakeAmount]
  );
  const interestRate = useMemo(
    () => estimatedRewards?.percentage.toString() ?? "",
    [estimatedRewards]
  );

  const symbol = selectedToken.symbol;
  const rewardsTokenSymbol = useMemo(
    () =>
      isBittensorStaking(selectedStake.id)
        ? EArray.head([...enterFlow.selectedValidators.values()]).pipe(
            Option.map((validator) => validator.subnet?.tokenSymbol ?? ""),
            Option.getOrElse(() => symbol)
          )
        : symbol,
    [enterFlow.selectedValidators, selectedStake, symbol]
  );

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

  const prices = review.prices;

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeEnterTxGas,
        prices,
        yieldDto: selectedStake,
      }),
    [prices, selectedStake, stakeEnterTxGas]
  );

  const { depositFee, managementFee, performanceFee } = useFees({
    amount: stakeAmount,
    token: selectedToken,
    feeConfigDto: null,
    yieldFee: useMemo(
      () =>
        (
          enterFlow.selectedStake as typeof enterFlow.selectedStake & {
            mechanics?: {
              fee?: {
                deposit?: string;
                management?: string;
                performance?: string;
              };
            };
          }
        ).mechanics?.fee ?? null,
      [enterFlow.selectedStake]
    ),
    prices,
  });

  const metadata = {
    logoURI: selectedStake.metadata.logoURI,
    name: selectedStake.metadata.name,
    provider: selectedStake.provider,
  };
  const kycProviderName = getKycProviderName(selectedStake);
  const onKycStatusRefresh = () => refreshKyc(undefined);

  const onClick = () => confirmFlow(undefined);

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  const cta = useMemo<PageCta>(
    () => ({
      disabled: review.confirmDisabled,
      isLoading: review.confirmLoading,
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
    }),
    [onClickRef, review.confirmDisabled, review.confirmLoading, t]
  );

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
    kycStatusIsChecking:
      review.kyc.isLoading || review.kyc.isFetching || review.kyc.isRefetching,
    onKycStatusRefresh,
    cta,
  };
};
