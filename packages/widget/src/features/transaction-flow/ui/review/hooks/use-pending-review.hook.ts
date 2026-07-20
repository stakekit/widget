import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { getRewardTokenSymbols } from "../../../../earn/react/use-reward-token-details/get-reward-token-symbols";
import type { RewardTokenDetails } from "../../../../earn/ui/components/reward-token-details";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useClassicFlowSessionFacade } from "../../../react/classic-flow-session-context";
import { useRequiredManageClassicTransactionFlow } from "../../../react/request-route-guards";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const manageFlow = useRequiredManageClassicTransactionFlow();
  const facade = useClassicFlowSessionFacade();
  useAtomMount(facade.reviewRouteAtom);
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const review = useAtomValue(facade.reviewViewAtom);
  const pendingTxGas = review.gasAmount;

  const amount = useMemo(
    () => new BigNumber(manageFlow.request.arguments?.amount ?? 0),
    [manageFlow.request.arguments?.amount]
  );

  const interactedToken = manageFlow.interactedToken;
  const integrationData = manageFlow.integration;

  const prices = review.prices;

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

  const onClick = () => confirmFlow(undefined);

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
      isLoading: review.confirmLoading,
    }),
    [onClickRef, review.confirmLoading, t]
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
    isGasCheckWarning: review.isGasCheckWarning,
    gasCheckLoading: review.gasCheckLoading,
    cta,
  };
};
