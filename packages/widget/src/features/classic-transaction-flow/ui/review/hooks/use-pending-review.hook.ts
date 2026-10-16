import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/action/pending-action";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import type { RewardTokenDetails } from "../../../../yield-summary/views";
import {
  useClassicFlowIntake,
  useClassicFlowReview,
} from "../../../react/classic-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page.tsx";

export const usePendingActionReview = () => {
  const manageFlow = useClassicFlowIntake("Manage");
  const facade = useClassicFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const review = useAtomValue(facade.reviewViewAtom);
  const pendingTxGas = review.gasAmount;

  const amount = exactDecimal(manageFlow.request.arguments?.amount ?? 0);

  const interactedToken = manageFlow.interactedToken;
  const integrationData = manageFlow.integration;

  const prices = review.prices;

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const title = t(
    `position_details.pending_action_button.${
      manageFlow.request.action.toLowerCase() as Lowercase<YieldPendingActionType>
    }` as const
  );

  const fee = getGasFeeInUSD({
    gas: pendingTxGas,
    locale,
    prices,
    yieldDto: integrationData,
  });

  const onClick = () => confirmFlow(undefined);

  const rewardTokenDetailsProps = integrationData.provider
    ? ({
        type: "pendingAction",
        pendingAction: manageFlow.request.action,
        rewardToken: {
          logoUri: integrationData.provider.logoURI,
          providerName: integrationData.provider.name,
          rewardTokens: [integrationData.token],
        },
      } satisfies ComponentProps<typeof RewardTokenDetails>)
    : null;

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: false,
    isLoading: review.confirmLoading,
  });

  const metaInfo: MetaInfoProps = { showMetaInfo: false };

  const formattedAmount = formatTokenAmount(amount, locale, "down");

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
