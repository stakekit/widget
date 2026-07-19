import { useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getTransactionGasEstimate } from "../../../../../domain/types/action";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../../../domain/types/yields";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { getRewardTokenSymbols } from "../../../../earn/react/use-reward-token-details/get-reward-token-symbols";
import { useYieldKycGate } from "../../../../earn/react/use-yield-kyc-gate";
import type { RewardTokenDetails } from "../../../../earn/ui/components/reward-token-details";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useRequiredExitClassicTransactionFlow } from "../../../react/request-route-guards";
import { classicTransactionFlowFacade } from "../../../state/classic-flow-facade";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const useUnstakeActionReview = () => {
  const exitFlow = useRequiredExitClassicTransactionFlow();
  const continueFlow = useAtomSet(classicTransactionFlowFacade.continueAtom);
  const retryFlow = useAtomSet(classicTransactionFlowFacade.retryAtom);
  const preparation = useAtomValue(
    classicTransactionFlowFacade.preparationAtom
  );
  const actionPreview = useAtomValue(
    classicTransactionFlowFacade.actionPreviewAtom
  );
  const trackEvent = useTrackEvent();

  const integrationData = exitFlow.integration;
  const yieldKycGate = useYieldKycGate({ yieldDto: integrationData });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;

  const action = actionPreview.pipe(AsyncResult.value, Option.getOrUndefined);

  const stakeExitTxGas = useMemo(() => {
    const total = action?.transactions.reduce((acc, transaction) => {
      const decoded = getTransactionGasEstimate(transaction);
      return acc.plus(decoded?.amount ?? 0);
    }, new BigNumber(0));
    return total && !total.isZero() ? total : null;
  }, [action]);

  const interactedToken = exitFlow.unstakeToken;

  const kycProviderName = getKycProviderName(integrationData);
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const prices = AsyncResult.getOrElse(
    useAtomValue(classicTransactionFlowFacade.reviewPricesAtom),
    () => null
  );

  const amount = useMemo(
    () => new BigNumber(exitFlow.request.arguments?.amount ?? 0),
    [exitFlow.request.arguments?.amount]
  );

  const gasWarning = useAtomValue(classicTransactionFlowFacade.gasWarningAtom);

  const { t } = useTranslation();

  const formattedAmount = useMemo(
    () => defaultFormattedNumber(amount),
    [amount]
  );

  const title = isUnstakeYieldType(getExtendedYieldType(integrationData))
    ? (t("position_details.unstake") as string)
    : t("position_details.withdraw");

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
    AsyncResult.isInitial(actionPreview) ||
    actionPreview.waiting ||
    preparation._tag === "Loading";

  const onClick = () => {
    if (unstakeIsLoading || kycGateIsBlocking) return;
    if (
      preparation._tag === "Failure" &&
      preparation.flowIdentity === exitFlow.identity
    ) {
      retryFlow(exitFlow.identity);
      return;
    }

    trackEvent("unstakeClicked", {
      yieldId: exitFlow.integration.id,
      amount: exitFlow.request.arguments?.amount,
    });
    continueFlow(exitFlow.identity);
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
      AsyncResult.isInitial(actionPreview) ||
      actionPreview.waiting ||
      AsyncResult.isInitial(gasWarning) ||
      gasWarning.waiting,
    isGasCheckWarning: !!gasWarning.pipe(
      AsyncResult.value,
      Option.getOrUndefined
    ),
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
