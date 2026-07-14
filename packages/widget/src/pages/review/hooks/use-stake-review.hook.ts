import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { getKycProviderName } from "../../../domain/types/kyc";
import { isBittensorStaking } from "../../../domain/types/yields";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../hooks/api/prices-atoms";
import { useActionPreview } from "../../../hooks/api/use-action-preview";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { usePositionDetailsStakeMatch } from "../../../hooks/navigation/use-position-details-stake-match";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useYieldType } from "../../../hooks/use-yield-type";
import {
  useEnterStakeRequest,
  useSetEnterStakeRequest,
} from "../../../providers/enter-stake-store";
import { useSettings } from "../../../providers/settings";
import { defaultFormattedNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import type { PageCta } from "../../components/page-cta";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterRequest = useEnterStakeRequest()!;
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
    command: enterRequest.requestDto,
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
    gasAmount: stakeEnterTxGas,
    gasFeeToken: enterRequest.gasFeeToken,
    address: enterRequest.addresses.address,
    additionalAddresses: enterRequest.addresses.additionalAddresses,
    isStake: true,
    stakeAmount,
    stakeToken: enterRequest.selectedToken,
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
    useAtomValue(
      pricesAtom(
        new PricesKey({
          request: getTokensPricesRequest({
            token: selectedToken,
            yieldDto: selectedStake,
          }),
        })
      )
    ),
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

  const { variant } = useSettings();

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

import { getActionProviderYieldId } from "../../../domain/types/action";
