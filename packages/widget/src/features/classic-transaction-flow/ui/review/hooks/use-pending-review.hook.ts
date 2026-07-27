import { useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import type { RewardTokenDetails } from "../../../../earn/components";
import type { PageCta } from "../../../../widget-shell/components";
import {
  useClassicFlowIntake,
  useClassicFlowReview,
} from "../../../react/classic-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const manageFlow = useClassicFlowIntake("Manage");
  const facade = useClassicFlowReview();
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

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: false,
    isLoading: review.confirmLoading,
  });

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
    cta: resolveCta(),
  };
};
