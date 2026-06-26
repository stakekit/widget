import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { NumberInputProps } from "../../../components/atoms/number-input";
import {
  equalTokens,
  getTokenPriceInUSD,
  stakeTokenSameAsGasToken,
} from "../../../domain";
import { getKycProviderName } from "../../../domain/types/kyc";
import type {
  BalanceDataKey,
  PositionsData,
} from "../../../domain/types/positions";
import { getInitSelectedValidators } from "../../../domain/types/stake";
import type { TronResourceType } from "../../../domain/types/tron";
import {
  getYieldActionArg,
  isYieldValidatorSelectionRequired,
  type Yield,
} from "../../../domain/types/yields";
import type { ValidatorDto } from "../../../generated/api/yield";
import { useTokenBalancesScan } from "../../../hooks/api/use-token-balances-scan";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { useYieldValidators } from "../../../hooks/api/use-yield-validators";
import { useNavigateWithScrollToTop } from "../../../hooks/navigation/use-navigate-with-scroll-to-top";
import {
  getPositionDetailsStakeReviewPath,
  usePositionDetailsStakeMatch,
} from "../../../hooks/navigation/use-position-details-stake-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useAddLedgerAccount } from "../../../hooks/use-add-ledger-account";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useYieldType } from "../../../hooks/use-yield-type";
import type { PageCta } from "../../../pages/components/page-cta";
import { useAmountValidation } from "../../../pages/details/earn-page/state/use-amount-validation";
import { useStakeEnterRequestDto } from "../../../pages/details/earn-page/state/use-stake-enter-request-dto";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { useEnterStakeStore } from "../../../providers/enter-stake-store";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { defaultFormattedNumber, formatNumber } from "../../../utils";
import { usePositionDetailsStakeMachine } from "../state/stake-machine";

const resolveProviderYieldId = (selectedStake: Maybe<Yield>) =>
  selectedStake
    .chainNullable((stake) => getYieldActionArg(stake, "enter", "providerId"))
    .filter((arg) => !!arg.required && !!arg.options?.length)
    .chain((arg) => List.head(arg.options ?? []));

const resolveTronResource = (selectedStake: Maybe<Yield>) =>
  selectedStake
    .chainNullable((stake) => getYieldActionArg(stake, "enter", "tronResource"))
    .filter((arg) => !!arg.required)
    .map(() => "ENERGY" as TronResourceType);

export const usePositionDetailsStake = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const positionDetailsStakeMatch = usePositionDetailsStakeMatch();
  const integrationId = positionDetailsStakeMatch?.params.integrationId ?? "";
  const balanceId = positionDetailsStakeMatch?.params.balanceId ?? "";
  const { intent, dispatch } = usePositionDetailsStakeMachine({
    integrationId,
    balanceId,
  });

  const selectedStake = positionDetails.integrationData;
  const selectedToken = selectedStake.map((stake) => stake.token);
  const selectedProviderYieldId = resolveProviderYieldId(selectedStake);
  const tronResource = Maybe.fromNullable(intent.tronResource).altLazy(() =>
    resolveTronResource(selectedStake)
  );

  const tokenBalancesScan = useTokenBalancesScan();
  const availableAmount = useMemo(
    () =>
      selectedToken
        .chain((token) =>
          Maybe.fromNullable(
            tokenBalancesScan.data?.find((balance) =>
              equalTokens(balance.token, token)
            )
          )
        )
        .map((balance) => new BigNumber(balance.amount)),
    [selectedToken, tokenBalancesScan.data]
  );

  const positionsData = useMemo(
    () =>
      selectedStake
        .map((stake) => {
          const balances = [
            ...positionDetails.positionBalancesByType
              .map((byType) => [...byType.values()].flat())
              .orDefault([]),
          ];

          return new Map([
            [
              stake.id,
              {
                yieldId: stake.id,
                rewardRate: stake.rewardRate,
                balanceData: new Map([
                  [
                    "default" as BalanceDataKey,
                    { type: "default" as const, balances },
                  ],
                ]),
              },
            ],
          ]) as PositionsData;
        })
        .orDefault(new Map() as PositionsData),
    [positionDetails.positionBalancesByType, selectedStake]
  );

  const {
    maxIntegrationAmount,
    minIntegrationAmount,
    minEnterOrExitAmount,
    maxEnterOrExitAmount,
    isForceMax,
  } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: selectedStake,
    availableAmount,
    positionsData,
  });

  const rawStakeAmount = new BigNumber(intent.stakeAmount);
  const stakeAmount =
    intent.useMaxAmount || !rawStakeAmount.isZero()
      ? rawStakeAmount
      : minEnterOrExitAmount;

  const selectedTokenAvailableAmount = useMemo(
    () =>
      availableAmount.map((amount) => ({
        symbol: selectedToken.mapOrDefault((token) => token.symbol, ""),
        shortFormattedAmount: defaultFormattedNumber(amount),
        fullFormattedAmount: formatNumber(amount),
        amount,
      })),
    [availableAmount, selectedToken]
  );

  const validatorsRequired = selectedStake
    .map(isYieldValidatorSelectionRequired)
    .orDefault(false);
  const yieldValidators = useYieldValidators({
    enabled: validatorsRequired,
    yieldId:
      selectedStake.map((stake) => stake.id).extractNullable() ?? undefined,
    network:
      selectedStake.map((stake) => stake.token.network).extractNullable() ??
      undefined,
  });
  const selectedValidators = useMemo(() => {
    if (!validatorsRequired) {
      return new Map<ValidatorDto["address"], ValidatorDto>();
    }

    const validators = yieldValidators.data ?? [];
    return getInitSelectedValidators({
      initQueryParams: Maybe.empty(),
      validators,
    });
  }, [validatorsRequired, yieldValidators.data]);

  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators,
    selectedProviderYieldId,
  });

  const pricesState = useTokensPrices({
    token: selectedToken,
    yieldDto: selectedStake,
  });

  const formattedPrice = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(pricesState.data),
        selectedStake,
        selectedToken,
      }).mapOrDefault(
        (value) =>
          `$${defaultFormattedNumber(
            getTokenPriceInUSD({
              baseToken: value.selectedStake.token,
              amount: stakeAmount,
              token: value.selectedToken,
              prices: value.prices,
              pricePerShare: null,
            })
          )}`,
        ""
      ),
    [pricesState.data, selectedStake, selectedToken, stakeAmount]
  );

  const stakeEnterRequestDto = useStakeEnterRequestDto({
    selectedProviderYieldId,
    selectedStake,
    selectedToken,
    selectedValidators,
    stakeAmount,
    tronResource,
    useMaxAmount: intent.useMaxAmount,
  });
  const yieldKycGate = useYieldKycGate({ yieldDto: selectedStake });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = selectedStake
    .map(getKycProviderName)
    .extractNullable();
  const onKycStatusRefresh = () => yieldKycGate.refetch();
  const { openConnectModal } = useConnectModal();
  const navigate = useNavigateWithScrollToTop();
  const enterStakeStore = useEnterStakeStore();
  const { isConnected, isLedgerLiveAccountPlaceholder, chain } = useSKWallet();

  const {
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountLessThanMin,
    stakeAmountIsZero,
  } = useAmountValidation({
    availableAmount,
    stakeAmount,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
  });

  const onClickHandler = useMutation({
    mutationFn: async () => {
      if (validation.hasErrors) return;
      if (stakeEnterRequestDto.isNothing()) return;

      if (!isConnected) return openConnectModal?.();
      if (kycGateIsBlocking) return;

      Maybe.fromRecord({
        selectedToken,
        stakeEnterRequestDto,
      }).ifJust((value) => {
        enterStakeStore.send({
          type: "initFlow",
          data: {
            addresses: value.stakeEnterRequestDto.addresses,
            requestDto: value.stakeEnterRequestDto.dto,
            selectedToken: value.selectedToken,
            gasFeeToken: value.stakeEnterRequestDto.gasFeeToken,
            selectedStake: value.stakeEnterRequestDto.selectedStake,
            selectedValidators: value.stakeEnterRequestDto.selectedValidators,
          },
        });
        navigate(
          getPositionDetailsStakeReviewPath({ balanceId, integrationId }) ??
            "/review"
        );
      });
    },
  });

  const validation = useMemo(() => {
    const errors = {
      tronResource: false,
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
    };

    if (
      isConnected &&
      selectedStake
        .chainNullable((stake) =>
          getYieldActionArg(stake, "enter", "tronResource")
        )
        .filter((arg) => !!arg.required)
        .isJust() &&
      tronResource.isNothing()
    ) {
      errors.tronResource = true;
    }

    return {
      submitted: onClickHandler.status !== "idle",
      hasErrors: Object.values(errors).some(Boolean),
      errors,
    };
  }, [
    isConnected,
    onClickHandler.status,
    selectedStake,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountIsZero,
    stakeAmountLessThanMin,
    tronResource,
  ]);

  const trackEvent = useTrackEvent();
  const onMaxClick = () => {
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: selectedStake.map((stake) => stake.id).extractNullable(),
    });
    dispatch({
      type: "stakeAmount/max",
      amount: maxEnterOrExitAmount.toString(10),
    });
  };
  const onStakeAmountChange: NumberInputProps["onChange"] = (amount) =>
    dispatch({ type: "stakeAmount/change", amount: amount.toString(10) });
  const onTronResourceSelect = (value: TronResourceType) =>
    dispatch({ type: "tronResource/select", tronResource: value });
  const onClickRef = useSavedRef(onClickHandler.mutate);

  const addLedgerAccount = useAddLedgerAccount();
  const connectClickRef = useSavedRef(() => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount.mutate(chain);
    }

    trackEvent("connectWalletClicked");
    openConnectModal?.();
  });

  const { externalProviders } = useSettings();
  const isFetching =
    positionDetails.isLoading ||
    tokenBalancesScan.isLoading ||
    yieldValidators.isLoading ||
    pricesState.isLoading;
  const buttonCTAText = useYieldType(selectedStake).mapOrDefault(
    (yieldType) => yieldType.cta,
    ""
  );
  const buttonDisabled =
    isConnected &&
    (isFetching || stakeEnterRequestDto.isNothing() || kycGateIsBlocking);
  const appLoading = positionDetails.isLoading || selectedStake.isNothing();
  const cta = useMemo<PageCta>(
    () =>
      isConnected && !isLedgerLiveAccountPlaceholder
        ? {
            disabled: buttonDisabled,
            isLoading: !buttonCTAText || isFetching || yieldKycGate.isLoading,
            onClick: () => onClickRef.current(),
            label: buttonCTAText,
          }
        : externalProviders
          ? null
          : {
              disabled: appLoading,
              isLoading: appLoading,
              label: t(
                isLedgerLiveAccountPlaceholder
                  ? "init.ledger_add_account"
                  : "init.connect_wallet"
              ),
              onClick: () => connectClickRef.current(),
            },
    [
      appLoading,
      buttonCTAText,
      buttonDisabled,
      connectClickRef,
      externalProviders,
      isConnected,
      isFetching,
      isLedgerLiveAccountPlaceholder,
      onClickRef,
      t,
      yieldKycGate.isLoading,
    ]
  );

  const stakeMaxAmount = selectedStake
    .filter(() => maxIntegrationAmount.isJust() && !isForceMax)
    .map(() => maxEnterOrExitAmount.toNumber());
  const stakeMinAmount = selectedStake
    .filter(() => minIntegrationAmount.isJust() && !isForceMax)
    .map(() => minEnterOrExitAmount.toNumber())
    .filter((value) => new BigNumber(value).isGreaterThan(0));
  const isStakeTokenSameAsGasToken = Maybe.fromRecord({
    selectedStake,
    selectedToken,
  }).mapOrDefault(
    (value) =>
      stakeTokenSameAsGasToken({
        stakeToken: value.selectedToken,
        yieldDto: value.selectedStake,
      }),
    false
  );

  return {
    appLoading,
    cta,
    estimatedRewards,
    footerIsLoading: isFetching,
    formattedPrice,
    isFetching,
    isStakeTokenSameAsGasToken,
    kycGate: yieldKycGate.gate,
    kycGateIsChecking:
      yieldKycGate.isLoading ||
      yieldKycGate.isFetching ||
      yieldKycGate.isRefetching,
    kycProviderName,
    onKycStatusRefresh,
    onMaxClick,
    onStakeAmountChange,
    onTronResourceSelect,
    positionDetails,
    selectedStake,
    selectedToken,
    selectedTokenAvailableAmount,
    selectedValidators,
    stakeAmount,
    stakeMaxAmount,
    stakeMinAmount,
    symbol: selectedToken.mapOrDefault((token) => token.symbol, ""),
    tronResource,
    validation,
  };
};
