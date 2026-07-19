import { useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { getTransactionGasEstimate } from "../../../../../domain/types/action";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import { isBittensorStaking } from "../../../../../domain/types/yields";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useEstimatedRewards } from "../../../../earn/react/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../../earn/react/use-reward-token-details";
import { useYieldKycGate } from "../../../../earn/react/use-yield-kyc-gate";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useRequiredEnterClassicTransactionFlow } from "../../../react/request-route-guards";
import { classicTransactionFlowFacade } from "../../../state/classic-flow-facade";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterFlow = useRequiredEnterClassicTransactionFlow();
  const continueFlow = useAtomSet(classicTransactionFlowFacade.continueAtom);
  const retryFlow = useAtomSet(classicTransactionFlowFacade.retryAtom);
  const preparation = useAtomValue(
    classicTransactionFlowFacade.preparationAtom
  );
  const actionPreview = useAtomValue(
    classicTransactionFlowFacade.actionPreviewAtom
  );

  const stakeAmount = useMemo(
    () => new BigNumber(enterFlow.request.arguments?.amount ?? 0),
    [enterFlow.request]
  );

  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;
  const yieldKycGate = useYieldKycGate({ yieldDto: selectedStake });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;

  const action = actionPreview.pipe(AsyncResult.value, Option.getOrUndefined);

  const stakeEnterTxGas = useMemo(() => {
    const total = action?.transactions.reduce((acc, transaction) => {
      const decoded = getTransactionGasEstimate(transaction);
      return acc.plus(decoded?.amount ?? 0);
    }, new BigNumber(0));
    return total && !total.isZero() ? total : null;
  }, [action]);

  const gasWarning = useAtomValue(classicTransactionFlowFacade.gasWarningAtom);

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

  const prices = AsyncResult.getOrElse(
    useAtomValue(classicTransactionFlowFacade.reviewPricesAtom),
    () => null
  );

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
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const onClick = () => {
    if (kycGateIsBlocking) return;
    if (
      preparation._tag === "Failure" &&
      preparation.flowIdentity === enterFlow.identity
    ) {
      retryFlow(enterFlow.identity);
      return;
    }
    continueFlow(enterFlow.identity);
  };

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  const cta = useMemo<PageCta>(
    () => ({
      disabled: kycGateIsBlocking,
      isLoading:
        AsyncResult.isInitial(actionPreview) ||
        actionPreview.waiting ||
        preparation._tag === "Loading" ||
        yieldKycGate.isLoading,
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
    }),
    [
      actionPreview,
      preparation._tag,
      kycGateIsBlocking,
      onClickRef,
      t,
      yieldKycGate.isLoading,
    ]
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
    isGasCheckWarning: !!gasWarning.pipe(
      AsyncResult.value,
      Option.getOrUndefined
    ),
    gasCheckLoading:
      AsyncResult.isInitial(actionPreview) ||
      actionPreview.waiting ||
      AsyncResult.isInitial(gasWarning) ||
      gasWarning.waiting,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: AsyncResult.isInitial(actionPreview),
    commissionFee: null,
    kycGate: yieldKycGate.gate,
    kycProviderName,
    kycStatusIsChecking:
      yieldKycGate.isLoading ||
      yieldKycGate.isFetching ||
      yieldKycGate.isRefetching,
    onKycStatusRefresh,
    cta,
  };
};

import { getActionProviderYieldId } from "../../../../../domain/types/action";
