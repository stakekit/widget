import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import type { ActionTypes } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { useSavedRef, useTokensPrices } from "../../../hooks";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useUnstakeOrPendingActionReview = () => {
  const stakeExitData = useStakeExitData();
  const pendingActionData = usePendingActionData();

  const pendingActionMatch = usePendingActionMatch();

  const pendingActionType = pendingActionData.pendingActionType;

  const { t } = useTranslation();

  const integrationData = pendingActionMatch
    ? pendingActionData.pendingActionData.map((val) => val.integrationData)
    : stakeExitData.stakeExitData.map((val) => val.integrationData);

  const amount = (
    pendingActionMatch ? pendingActionData.amount : stakeExitData.amount
  ).map((val) => formatNumber(val));

  const title: Maybe<string> = pendingActionMatch
    ? pendingActionType.map((type) =>
        t(
          `position_details.pending_action_button.${
            type.toLowerCase() as Lowercase<ActionTypes>
          }` as const
        )
      )
    : integrationData.map((d) => {
        switch (d.metadata.type) {
          case "staking":
          case "liquid-staking":
            return t("position_details.unstake");

          default:
            return t("position_details.withdraw");
        }
      });

  const navigate = useNavigate();

  const token = pendingActionMatch
    ? pendingActionData.pendingActionData.map((val) => val.interactedToken)
    : stakeExitData.stakeExitData.map((val) => val.interactedToken);

  const pricesState = useTokensPrices({
    token,
    yieldDto: integrationData,
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingActionMatch
          ? pendingActionData.pendingActionTxGas
          : stakeExitData.stakeExitTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [
      integrationData,
      pendingActionData.pendingActionTxGas,
      pendingActionMatch,
      pricesState.data,
      stakeExitData.stakeExitTxGas,
    ]
  );

  const onClick = () => {
    navigate("../steps", { relative: "path" });
  };

  const rewardTokenDetailsProps = integrationData
    .chainNullable((v) =>
      v.metadata.provider ? { provider: v.metadata.provider, rest: v } : null
    )
    .map((v) => {
      const rewardToken = Maybe.of({
        logoUri: v.provider.logoURI,
        providerName: v.provider.name,
        symbols: getRewardTokenSymbols([v.rest.token]),
        rewardTokens: [v.rest.token],
      }) satisfies ComponentProps<typeof RewardTokenDetails>["rewardToken"];

      return (
        pendingActionMatch
          ? {
              type: "pendingAction",
              pendingAction: pendingActionType.extract()!,
              rewardToken,
            }
          : { type: "unstake", rewardToken }
      ) satisfies ComponentProps<typeof RewardTokenDetails>;
    });

  const onClickRef = useSavedRef(onClick);

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
        disabled: false,
        isLoading: false,
      }),
      [onClickRef, t]
    )
  );

  const isGasCheckError = pendingActionMatch
    ? pendingActionData.isGasCheckError
    : stakeExitData.isGasCheckError;

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  return {
    integrationData,
    title,
    amount,
    fee,
    rewardTokenDetailsProps,
    pendingActionMatch,
    isGasCheckError,
    token,
    metaInfo,
  };
};
