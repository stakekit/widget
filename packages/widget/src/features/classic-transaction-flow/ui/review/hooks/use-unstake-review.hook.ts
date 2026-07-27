import { useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../../../domain/types/yields";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import type { RewardTokenDetails } from "../../../../earn/components";
import type { PageCta } from "../../../../widget-shell/components";
import {
  useClassicFlowIntake,
  useClassicFlowReview,
} from "../../../react/classic-flow-route";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const useUnstakeActionReview = () => {
  const exitFlow = useClassicFlowIntake("Exit");
  const facade = useClassicFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const refreshKyc = useAtomSet(facade.refreshKycAtom);
  const review = useAtomValue(facade.reviewViewAtom);

  const integrationData = exitFlow.integration;
  const stakeExitTxGas = review.gasAmount;

  const interactedToken = exitFlow.unstakeToken;

  const kycProviderName = getKycProviderName(integrationData);
  const onKycStatusRefresh = () => refreshKyc(undefined);

  const prices = review.prices;

  const amount = useMemo(
    () => new BigNumber(exitFlow.request.arguments?.amount ?? 0),
    [exitFlow.request.arguments?.amount]
  );

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
          rewardTokens: [integrationData.token],
        },
      } satisfies ComponentProps<typeof RewardTokenDetails>)
    : null;

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

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
    kycStatusIsChecking:
      review.kyc.isLoading || review.kyc.isFetching || review.kyc.isRefetching,
    onKycStatusRefresh,
    cta: resolveCta(),
  };
};
