import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useConnectModal } from "@stakekit/rainbowkit";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addLedgerAccountAtom } from "../../../atoms/wallet-workflows";
import type { NumberInputProps } from "../../../components/atoms/number-input";
import {
  equalTokens,
  getTokenPriceInUSD,
  stakeTokenSameAsGasToken,
} from "../../../domain";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { TronResource } from "../../../domain/schema/legacy-models";
import { getKycProviderName } from "../../../domain/types/kyc";
import type {
  BalanceDataKey,
  PositionsData,
} from "../../../domain/types/positions";
import { getInitSelectedValidators } from "../../../domain/types/stake";

import type { ValidatorKey } from "../../../domain/types/validators";
import {
  getYieldActionArg,
  getYieldProviderYieldIds,
  isYieldValidatorSelectionRequired,
} from "../../../domain/types/yields";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../hooks/api/prices-atoms";
import { useTokenBalancesScan } from "../../../hooks/api/use-token-balances-scan";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { useYieldValidators } from "../../../hooks/api/use-yield-validators";
import { useNavigateWithScrollToTop } from "../../../hooks/navigation/use-navigate-with-scroll-to-top";
import {
  getPositionDetailsStakeReviewPath,
  usePositionDetailsStakeMatch,
} from "../../../hooks/navigation/use-position-details-stake-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useCloseChainModal } from "../../../hooks/use-close-chain-modal";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useYieldType } from "../../../hooks/use-yield-type";
import type { PageCta } from "../../../pages/components/page-cta";
import { useAmountValidation } from "../../../pages/details/earn-page/state/use-amount-validation";
import { useStakeEnterRequestDto } from "../../../pages/details/earn-page/state/use-stake-enter-request-dto";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { useSetEnterStakeRequest } from "../../../providers/enter-stake-store";
import { isLedgerLiveConnector } from "../../../providers/ledger/ledger-live-connector-meta";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { defaultFormattedNumber, formatNumber } from "../../../utils";
import { usePositionDetailsStakeMachine } from "../state/stake-machine";

const resolveProviderYieldId = (
  selectedStake: EarnYieldWithProvider | null
) => {
  const argument = selectedStake
    ? getYieldActionArg(selectedStake, "enter", "providerId")
    : null;
  const providerYieldIds = selectedStake
    ? getYieldProviderYieldIds(selectedStake)
    : [];
  return argument?.required && providerYieldIds.length
    ? EArray.head(providerYieldIds).pipe(Option.getOrNull)
    : null;
};

const resolveTronResource = (selectedStake: EarnYieldWithProvider | null) =>
  selectedStake &&
  getYieldActionArg(selectedStake, "enter", "tronResource")?.required
    ? ("ENERGY" as TronResource)
    : null;

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
  const selectedToken = selectedStake?.token ?? null;
  const selectedProviderYieldId = resolveProviderYieldId(selectedStake);
  const tronResource =
    intent.tronResource ?? resolveTronResource(selectedStake);

  const tokenBalancesScan = useTokenBalancesScan();
  const availableAmount = useMemo(
    () =>
      selectedToken
        ? (() => {
            const balance = tokenBalancesScan.data?.find((value) =>
              equalTokens(value.token, selectedToken)
            );
            return balance ? new BigNumber(balance.amount) : null;
          })()
        : null,
    [selectedToken, tokenBalancesScan.data]
  );

  const positionsData = useMemo(
    () =>
      selectedStake
        ? (() => {
            const balances = [
              ...(positionDetails.positionBalancesByType
                ? [...positionDetails.positionBalancesByType.values()].flat()
                : []),
            ];

            return new Map([
              [
                selectedStake.id,
                {
                  yieldId: selectedStake.id,
                  rewardRate: selectedStake.rewardRate,
                  balanceData: new Map([
                    [
                      "default" as BalanceDataKey,
                      { type: "default" as const, balances },
                    ],
                  ]),
                },
              ],
            ]) as PositionsData;
          })()
        : (new Map() as PositionsData),
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
      availableAmount
        ? {
            symbol: selectedToken?.symbol ?? "",
            shortFormattedAmount: defaultFormattedNumber(availableAmount),
            fullFormattedAmount: formatNumber(availableAmount),
            amount: availableAmount,
          }
        : null,
    [availableAmount, selectedToken]
  );

  const validatorsRequired = selectedStake
    ? isYieldValidatorSelectionRequired(selectedStake)
    : false;
  const yieldValidators = useYieldValidators({
    enabled: validatorsRequired,
    yieldId: selectedStake?.id,
    network: selectedStake?.token.network,
  });
  const selectedValidators = useMemo(() => {
    if (!validatorsRequired) {
      return new Map<ValidatorKey, EarnValidator>();
    }

    const validators = yieldValidators.data ?? [];
    return getInitSelectedValidators({
      initQueryParams: null,
      validators,
    });
  }, [validatorsRequired, yieldValidators.data]);

  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators,
    selectedProviderYieldId,
  });

  const pricesRequest = getTokensPricesRequest({
    token: selectedToken,
    yieldDto: selectedStake,
  });
  const pricesResult = useAtomValue(
    pricesAtom(new PricesKey({ request: pricesRequest }))
  );
  const prices = AsyncResult.getOrElse(pricesResult, () => null);

  const formattedPrice = useMemo(
    () =>
      prices && selectedStake && selectedToken
        ? `$${defaultFormattedNumber(
            getTokenPriceInUSD({
              baseToken: selectedStake.token,
              amount: stakeAmount,
              token: selectedToken,
              prices,
              pricePerShare: null,
            })
          )}`
        : "",
    [prices, selectedStake, selectedToken, stakeAmount]
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
  const yieldKycGate = useYieldKycGate({
    yieldDto: selectedStake,
  });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = selectedStake
    ? getKycProviderName(selectedStake)
    : null;
  const onKycStatusRefresh = () => yieldKycGate.refetch();
  const { openConnectModal } = useConnectModal();
  const navigate = useNavigateWithScrollToTop();
  const setEnterStakeRequest = useSetEnterStakeRequest();
  const { isConnected, isLedgerLiveAccountPlaceholder, chain, connector } =
    useSKWallet();

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

  const [submitted, setSubmitted] = useState(false);
  const onClickHandler = () => {
    setSubmitted(true);
    if (validation.hasErrors) return;
    const selectedTokenValue = selectedToken;
    if (!stakeEnterRequestDto || !selectedTokenValue) return;

    if (!isConnected) return openConnectModal?.();
    if (kycGateIsBlocking) return;

    setEnterStakeRequest({
      actionDto: null,
      addresses: stakeEnterRequestDto.addresses,
      requestDto: stakeEnterRequestDto.dto,
      selectedToken: selectedTokenValue,
      gasFeeToken: stakeEnterRequestDto.gasFeeToken,
      selectedStake: stakeEnterRequestDto.selectedStake,
      selectedValidators: stakeEnterRequestDto.selectedValidators,
    });
    navigate(
      getPositionDetailsStakeReviewPath({ balanceId, integrationId }) ??
        "/review"
    );
  };

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
      selectedStake &&
      getYieldActionArg(selectedStake, "enter", "tronResource")?.required &&
      !tronResource
    ) {
      errors.tronResource = true;
    }

    return {
      submitted,
      hasErrors: Object.values(errors).some(Boolean),
      errors,
    };
  }, [
    isConnected,
    submitted,
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
      yieldId: selectedStake?.id,
    });
    dispatch({
      type: "stakeAmount/max",
      amount: maxEnterOrExitAmount.toString(10),
    });
  };
  const onStakeAmountChange: NumberInputProps["onChange"] = (amount) =>
    dispatch({ type: "stakeAmount/change", amount: amount.toString(10) });
  const onTronResourceSelect = (value: TronResource) =>
    dispatch({ type: "tronResource/select", tronResource: value });
  const onClickRef = useSavedRef(onClickHandler);

  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);
  const { closeChainModal } = useCloseChainModal();
  const connectClickRef = useSavedRef(() => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount({
        chain,
        closeChainModal,
        connector:
          connector && isLedgerLiveConnector(connector) ? connector : null,
      });
    }

    trackEvent("connectWalletClicked");
    openConnectModal?.();
  });

  const { externalProviders } = useSettings();
  const isFetching =
    positionDetails.isLoading ||
    tokenBalancesScan.isLoading ||
    yieldValidators.isLoading ||
    (!!pricesRequest && AsyncResult.isInitial(pricesResult));
  const buttonCTAText = useYieldType(selectedStake)?.cta ?? "";
  const buttonDisabled =
    isConnected && (isFetching || !stakeEnterRequestDto || kycGateIsBlocking);
  const appLoading = positionDetails.isLoading || !selectedStake;
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

  const stakeMaxAmount =
    selectedStake && maxIntegrationAmount && !isForceMax
      ? maxEnterOrExitAmount.toNumber()
      : null;
  const candidateMinAmount = minEnterOrExitAmount.toNumber();
  const stakeMinAmount =
    selectedStake &&
    minIntegrationAmount &&
    !isForceMax &&
    new BigNumber(candidateMinAmount).isGreaterThan(0)
      ? candidateMinAmount
      : null;
  const isStakeTokenSameAsGasToken =
    selectedStake && selectedToken
      ? stakeTokenSameAsGasToken({
          stakeToken: selectedToken,
          yieldDto: selectedStake,
        })
      : false;

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
    symbol: selectedToken?.symbol ?? "",
    tronResource,
    validation,
  };
};
