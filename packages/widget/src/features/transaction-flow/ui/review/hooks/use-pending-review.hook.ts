import { useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getTransactionGasEstimate } from "../../../../../domain/types/action";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { getRewardTokenSymbols } from "../../../../earn/react/use-reward-token-details/get-reward-token-symbols";
import type { RewardTokenDetails } from "../../../../earn/ui/components/reward-token-details";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useRequiredManageClassicTransactionFlow } from "../../../react/request-route-guards";
import { classicTransactionFlowFacade } from "../../../state/classic-flow-facade";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const manageFlow = useRequiredManageClassicTransactionFlow();
  const continueFlow = useAtomSet(classicTransactionFlowFacade.continueAtom);
  const retryFlow = useAtomSet(classicTransactionFlowFacade.retryAtom);
  const preparation = useAtomValue(
    classicTransactionFlowFacade.preparationAtom
  );
  const actionPreview = useAtomValue(
    classicTransactionFlowFacade.actionPreviewAtom
  );
  const action = actionPreview.pipe(AsyncResult.value, Option.getOrUndefined);

  const pendingTxGas = useMemo(() => {
    const total = action?.transactions.reduce((acc, transaction) => {
      const decoded = getTransactionGasEstimate(transaction);
      return acc.plus(decoded?.amount ?? 0);
    }, new BigNumber(0));
    return total && !total.isZero() ? total : null;
  }, [action]);

  const amount = useMemo(
    () => new BigNumber(manageFlow.request.arguments?.amount ?? 0),
    [manageFlow.request.arguments?.amount]
  );

  const interactedToken = manageFlow.interactedToken;
  const integrationData = manageFlow.integration;

  const prices = AsyncResult.getOrElse(
    useAtomValue(classicTransactionFlowFacade.reviewPricesAtom),
    () => null
  );

  const gasWarning = useAtomValue(classicTransactionFlowFacade.gasWarningAtom);

  const { t } = useTranslation();

  const title = useMemo(
    () =>
      t(
        `position_details.pending_action_button.${
          manageFlow.request.action.toLowerCase() as Lowercase<YieldPendingActionType>
        }` as const
      ),
    [manageFlow.request.action, t]
  );

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices,
        yieldDto: integrationData,
      }),
    [integrationData, pendingTxGas, prices]
  );

  const onClick = () => {
    if (
      preparation._tag === "Failure" &&
      preparation.flowIdentity === manageFlow.identity
    ) {
      retryFlow(manageFlow.identity);
      return;
    }
    continueFlow(manageFlow.identity);
  };

  const rewardTokenDetailsProps = useMemo(
    () =>
      integrationData.provider
        ? (() => {
            const rewardToken = {
              logoUri: integrationData.provider.logoURI,
              providerName: integrationData.provider.name,
              symbols: getRewardTokenSymbols([integrationData.token]),
              rewardTokens: [integrationData.token],
            } satisfies ComponentProps<
              typeof RewardTokenDetails
            >["rewardToken"];

            return {
              type: "pendingAction",
              pendingAction: manageFlow.request.action,
              rewardToken,
            } satisfies ComponentProps<typeof RewardTokenDetails>;
          })()
        : null,
    [integrationData, manageFlow.request.action]
  );

  const onClickRef = useSavedRef(onClick);

  const cta = useMemo<PageCta>(
    () => ({
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
      disabled: false,
      isLoading:
        AsyncResult.isInitial(actionPreview) ||
        actionPreview.waiting ||
        preparation._tag === "Loading",
    }),
    [actionPreview, onClickRef, preparation._tag, t]
  );

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  const formattedAmount = useMemo(
    () => defaultFormattedNumber(amount),
    [amount]
  );

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
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
    cta,
  };
};
