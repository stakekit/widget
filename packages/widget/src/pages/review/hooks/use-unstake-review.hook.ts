import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { getValidStakeSessionTx } from "../../../domain";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { getKycProviderName } from "../../../domain/types/kyc";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../domain/types/yields";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../hooks/api/prices-atoms";
import { useActionPreview } from "../../../hooks/api/use-action-preview";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "../../../hooks/use-reward-token-details/get-reward-token-symbols";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import {
  useExitStakeRequest,
  useSetExitStakeRequest,
} from "../../../providers/exit-stake-store";
import { defaultFormattedNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import type { PageCta } from "../../components/page-cta";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const useUnstakeActionReview = () => {
  const exitRequest = useExitStakeRequest()!;

  const setExitStakeRequest = useSetExitStakeRequest();
  const trackEvent = useTrackEvent();

  const integrationData = exitRequest.integrationData;
  const yieldKycGate = useYieldKycGate({ yieldDto: integrationData });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;

  const actionPreviewQuery = useActionPreview({
    command: exitRequest.requestDto,
    enabled: !!exitRequest && !kycGateIsBlocking,
    intent: "exit",
  });

  const stakeExitTxGas = useMemo(() => {
    const total = actionPreviewQuery.data?.transactions.reduce(
      (acc, transaction) => {
        const decoded = getTransactionGasEstimate(transaction);
        return acc.plus(decoded?.amount ?? 0);
      },
      new BigNumber(0)
    );
    return total && !total.isZero() ? total : null;
  }, [actionPreviewQuery.data]);

  const interactedToken = exitRequest.unstakeToken;

  const kycProviderName = getKycProviderName(integrationData);
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const prices = AsyncResult.getOrElse(
    useAtomValue(
      pricesAtom(
        new PricesKey({
          request: getTokensPricesRequest({
            token: interactedToken,
            yieldDto: integrationData,
          }),
        })
      )
    ),
    () => null
  );

  const amount = useMemo(
    () => new BigNumber(exitRequest.requestDto.arguments?.amount ?? 0),
    [exitRequest.requestDto.arguments?.amount]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: stakeExitTxGas,
    gasFeeToken: exitRequest.gasFeeToken,
    address: exitRequest.addresses.address,
    additionalAddresses: exitRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const { t } = useTranslation();

  const formattedAmount = useMemo(
    () => defaultFormattedNumber(amount),
    [amount]
  );

  const title = isUnstakeYieldType(getExtendedYieldType(integrationData))
    ? (t("position_details.unstake") as string)
    : t("position_details.withdraw");

  const navigate = useNavigate();

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeExitTxGas,
        prices,
        yieldDto: integrationData,
      }),
    [integrationData, prices, stakeExitTxGas]
  );

  const rewardTokenDetailsProps = integrationData.provider
    ? ({
        type: "unstake",
        rewardToken: {
          logoUri: integrationData.provider.logoURI,
          providerName: integrationData.provider.name,
          symbols: getRewardTokenSymbols([integrationData.token]),
          rewardTokens: [integrationData.token],
        },
      } satisfies ComponentProps<typeof RewardTokenDetails>)
    : null;

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  const unstakeIsLoading =
    actionPreviewQuery.isLoading || actionPreviewQuery.isFetching;

  const onClick = () => {
    if (unstakeIsLoading || kycGateIsBlocking) return;
    if (!actionPreviewQuery.data) {
      actionPreviewQuery.refetch();
      return;
    }

    trackEvent("unstakeClicked", {
      yieldId: exitRequest.integrationData.id,
      amount: exitRequest.requestDto.arguments?.amount,
    });
    const validSession = getValidStakeSessionTx(actionPreviewQuery.data);
    if (Result.isSuccess(validSession)) {
      setExitStakeRequest((request) =>
        request ? { ...request, actionDto: validSession.success } : null
      );
      navigate("../steps", { relative: "path" });
    }
  };

  const onClickRef = useSavedRef(onClick);

  const cta = useMemo<PageCta>(
    () => ({
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
      disabled: kycGateIsBlocking,
      isLoading: unstakeIsLoading || yieldKycGate.isLoading,
    }),
    [kycGateIsBlocking, onClickRef, t, unstakeIsLoading, yieldKycGate.isLoading]
  );

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    onContinueUnstakeSignMessage: () => {},
    onCloseUnstakeSignMessage: () => {},
    showUnstakeSignMessagePopup: false,
    gasCheckLoading:
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasWarningCheck.isLoading,
    isGasCheckWarning: !!gasWarningCheck.data,
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
