import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useWidgetConfig } from "../../../../../app/config";
import { getTransactionGasEstimate } from "../../../../../domain/types/action";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import { isBittensorStaking } from "../../../../../domain/types/yields";
import { defaultFormattedNumber } from "../../../../../shared/lib";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { usePositionDetailsStakeMatch } from "../../../../../shared/react/navigation/use-position-details-stake-match";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useYieldKycGate } from "../../../../earn";
import {
  useEstimatedRewards,
  useRewardTokenDetails,
  useYieldType,
} from "../../../../earn/support";
import type { PageCta } from "../../../../widget-shell";
import {
  useActionPreview,
  useRequiredEnterStakeRequest,
  useSetEnterStakeRequest,
} from "../../..";
import { useGasWarningCheck } from "../../../react/use-gas-warning-check";
import { currentReviewPricesAtom } from "../../../resources/review-prices";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterRequest = useRequiredEnterStakeRequest();
  const setEnterStakeRequest = useSetEnterStakeRequest();

  const stakeAmount = useMemo(
    () => new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0),
    [enterRequest]
  );

  const selectedStake = enterRequest.selectedStake;
  const selectedToken = enterRequest.selectedToken;
  const yieldKycGate = useYieldKycGate({ yieldDto: selectedStake });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;

  const actionPreviewQuery = useActionPreview({
    enabled: !!enterRequest && !kycGateIsBlocking,
    intent: "enter",
  });

  const stakeEnterTxGas = useMemo(() => {
    const total = actionPreviewQuery.data?.transactions.reduce(
      (acc, transaction) => {
        const decoded = getTransactionGasEstimate(transaction);
        return acc.plus(decoded?.amount ?? 0);
      },
      new BigNumber(0)
    );
    return total && !total.isZero() ? total : null;
  }, [actionPreviewQuery.data]);

  const gasCheckWarning = useGasWarningCheck({
    enabled: !kycGateIsBlocking,
    intent: "enter",
  });

  const selectedProviderYieldId = getActionProviderYieldId(
    enterRequest.requestDto
  );

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators: enterRequest.selectedValidators,
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
        ? EArray.head([...enterRequest.selectedValidators.values()]).pipe(
            Option.map((validator) => validator.subnet?.tokenSymbol ?? ""),
            Option.getOrElse(() => symbol)
          )
        : symbol,
    [enterRequest.selectedValidators, selectedStake, symbol]
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
    useAtomValue(currentReviewPricesAtom("enter")),
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
          enterRequest.selectedStake as typeof enterRequest.selectedStake & {
            mechanics?: {
              fee?: {
                deposit?: string;
                management?: string;
                performance?: string;
              };
            };
          }
        ).mechanics?.fee ?? null,
      [enterRequest.selectedStake]
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

  const navigate = useNavigate();
  const positionDetailsStakeReviewMatch =
    usePositionDetailsStakeMatch("review");

  const onClick = () => {
    if (kycGateIsBlocking) return;
    const action = actionPreviewQuery.data;
    if (!action) {
      actionPreviewQuery.refetch();
      return;
    }

    setEnterStakeRequest((request) =>
      request ? { ...request, actionDto: action } : null
    );
    if (positionDetailsStakeReviewMatch) {
      navigate("../steps", { relative: "path" });
      return;
    }

    navigate("/steps");
  };

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  const cta = useMemo<PageCta>(
    () => ({
      disabled: kycGateIsBlocking,
      isLoading:
        actionPreviewQuery.isLoading ||
        actionPreviewQuery.isFetching ||
        yieldKycGate.isLoading,
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
    }),
    [
      actionPreviewQuery.isFetching,
      actionPreviewQuery.isLoading,
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
              selectedValidators: enterRequest.selectedValidators,
            },
          }
        : { showMetaInfo: false }) satisfies MetaInfoProps,
    [selectedStake, selectedToken, enterRequest.selectedValidators, variant]
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
    isGasCheckWarning: !!gasCheckWarning.data,
    gasCheckLoading:
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasCheckWarning.isLoading,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: actionPreviewQuery.isLoading,
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
