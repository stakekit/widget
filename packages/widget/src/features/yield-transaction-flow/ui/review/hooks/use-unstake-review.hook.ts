import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { getKycProviderName } from "../../../../../domain/earn/kyc";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import type { RewardTokenDetails } from "../../../../yield-summary/views";
import {
  useYieldFlowIntake,
  useYieldFlowReview,
} from "../../../react/yield-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page.tsx";

export const useUnstakeActionReview = () => {
  const exitFlow = useYieldFlowIntake("Exit");
  const facade = useYieldFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const integrationData = exitFlow.integration;
  const stakeExitTxGas = review.gasAmount;

  const interactedToken = exitFlow.unstakeToken;

  const kycProviderName = getKycProviderName(integrationData);
  const onKycStatusRefresh = () => refreshKyc(undefined);

  const prices = review.prices;

  const amount = exactDecimal(exitFlow.request.arguments?.amount ?? 0);

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const formattedAmount = formatTokenAmount(amount, locale, "down");

  const title = isUnstakeYieldType(getExtendedYieldType(integrationData))
    ? (t("position_details.unstake") as string)
    : t("position_details.withdraw");

  const fee = getGasFeeInUSD({
    gas: stakeExitTxGas,
    locale,
    prices,
    yieldDto: integrationData,
  });

  const rewardTokenDetailsProps = integrationData.provider
    ? ({
        type: "unstake",
        rewardToken: {
          logoUri: integrationData.provider.logoURI,
          providerName: integrationData.provider.name,
          rewardTokens: [integrationData.token],
        },
      } satisfies ComponentProps<typeof RewardTokenDetails>)
    : null;

  const metaInfo: MetaInfoProps = { showMetaInfo: false };
  const facts = exitFlow.receiveToken
    ? [
        {
          label: t("review.receive_token"),
          value: exitFlow.receiveToken.symbol,
        },
      ]
    : [];

  const unstakeIsLoading = review.confirmLoading;

  const onClick = () => confirmFlow(undefined);

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: review.confirmDisabled,
    isLoading: unstakeIsLoading,
  });

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    facts,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    onContinueUnstakeSignMessage: () => {},
    onCloseUnstakeSignMessage: () => {},
    showUnstakeSignMessagePopup: false,
    gasCheckLoading: review.gasCheckLoading,
    isGasCheckWarning: review.isGasCheckWarning,
    kycGate: review.kyc.gate,
    kycProviderName,
    kycStatusIsChecking: review.kyc.isChecking,
    onKycStatusRefresh,
    cta: resolveCta(),
  };
};
