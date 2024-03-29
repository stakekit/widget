import { useNavigate } from "react-router-dom";
import { ComponentProps, useMemo } from "react";
import { usePrices } from "../../../hooks/api/use-prices";
import { config } from "../../../config";
import { getBaseToken } from "../../../domain";
import { tokenToTokenDto } from "../../../utils/mappers";
import { Maybe } from "purify-ts";
import { formatNumber } from "../../../utils";
import { useTranslation } from "react-i18next";
import BigNumber from "bignumber.js";
import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { ActionTypes } from "@stakekit/api-hooks";
import { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import { useSavedRef } from "../../../hooks";
import { getGasFeeInUSD } from "../../../utils/formatters";

export const useUnstakeOrPendingActionReview = () => {
  const { integrationData, isGasCheckError } = useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();

  const { unstakeAmount, pendingActionSession } =
    useUnstakeOrPendingActionState();

  const pendingActionType = pendingActionSession.map((val) => val.type);

  const { t } = useTranslation();

  const amount = pendingActionMatch
    ? pendingActionSession.map((val) =>
        formatNumber(new BigNumber(val.amount ?? 0))
      )
    : Maybe.of(formatNumber(unstakeAmount));

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

          case "lending":
          case "vault":
          default:
            return t("position_details.withdraw");
        }
      });

  const navigate = useNavigate();

  const { stakeExitTxGas, pendingActionTxGas } =
    useUnstakeOrPendingActionState();

  const pricesState = usePrices({
    currency: config.currency,
    tokenList: integrationData.mapOrDefault(
      (d) => [d.token, tokenToTokenDto(getBaseToken(d.token))],
      []
    ),
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingActionMatch ? pendingActionTxGas : stakeExitTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [
      integrationData,
      pendingActionMatch,
      pendingActionTxGas,
      pricesState.data,
      stakeExitTxGas,
    ]
  );

  const onClick = () => {
    navigate("../steps", { relative: "path" });
  };

  const rewardTokenDetailsProps = integrationData
    .chainNullable((v) =>
      v.metadata.provider ? { provider: v.metadata.provider, rest: v } : null
    )
    .map<ComponentProps<typeof RewardTokenDetails>>((v) => {
      const rewardToken = Maybe.of({
        logoUri: v.provider.logoURI,
        providerName: v.provider.name,
        symbol: v.rest.token.symbol,
      });

      return pendingActionMatch
        ? {
            type: "pendingAction",
            pendingAction: pendingActionType.extract()!,
            rewardToken,
          }
        : { type: "unstake", rewardToken };
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

  return {
    integrationData,
    title,
    amount,
    fee,
    rewardTokenDetailsProps,
    pendingActionMatch,
    isGasCheckError,
  };
};
