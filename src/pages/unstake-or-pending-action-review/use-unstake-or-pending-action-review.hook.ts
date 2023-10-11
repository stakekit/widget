import { useMatch, useNavigate, useParams } from "react-router-dom";
import { ComponentProps, useMemo } from "react";
import { usePrices } from "../../hooks/api/use-prices";
import { config } from "../../config";
import { getBaseToken, getTokenPriceInUSD } from "../../domain";
import { Token } from "@stakekit/common";
import { tokenToTokenDto } from "../../utils/mappers";
import { Maybe } from "purify-ts";
import { formatNumber } from "../../utils";
import { useTranslation } from "react-i18next";
import BigNumber from "bignumber.js";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { ActionTypes } from "@stakekit/api-hooks";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";

export const useUnstakeOrPendingActionReview = () => {
  const params = useParams<{
    integrationId: string;
    defaultOrValidatorId: "default" | (string & {});
  }>();

  const integrationId = params.integrationId;

  const yieldOpportunity = useYieldOpportunity(integrationId);
  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/review"
  );

  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionType = pendingActionSession.map((val) => val.type);

  const { t } = useTranslation();

  const amount = pendingActionMatch
    ? pendingActionSession.map((val) =>
        formatNumber(new BigNumber(val.amount ?? 0))
      )
    : unstake.chain((u) => u.amount).map((val) => formatNumber(val));

  const title = pendingActionMatch
    ? pendingActionType.map((type) =>
        t(
          `position_details.pending_action_button.${
            type.toLowerCase() as Lowercase<ActionTypes>
          }`
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

  const txGas = pendingActionMatch ? pendingActionTxGas : stakeExitTxGas;

  const pricesState = usePrices({
    currency: config.currency,
    tokenList: integrationData.mapOrDefault(
      (d) => [d.token, tokenToTokenDto(getBaseToken(d.token as Token))],
      []
    ),
  });

  const gasFeeInUSD = useMemo(
    () =>
      Maybe.fromRecord({
        integrationData,
        prices: Maybe.fromNullable(pricesState.data),
        txGas,
      }).map((val) =>
        getTokenPriceInUSD({
          amount: val.txGas.toString(),
          prices: val.prices,
          token: getBaseToken(val.integrationData.token as Token),
          pricePerShare: undefined,
        })
      ),
    [integrationData, pricesState.data, txGas]
  );

  const tokenNetwork = integrationData.mapOrDefault(
    (d) => d.metadata.gasFeeToken.symbol,
    ""
  );

  const fee = useMemo(
    () =>
      txGas
        .chain((setg) => gasFeeInUSD.map((gfiu) => ({ setg, gfiu })))
        .mapOrDefault(
          ({ gfiu, setg }) =>
            `${formatNumber(setg)} ${tokenNetwork} ($${formatNumber(gfiu)})`,
          ""
        ),
    [gasFeeInUSD, txGas, tokenNetwork]
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

  return {
    integrationData,
    title,
    amount,
    onClick,
    fee,
    rewardTokenDetailsProps,
  };
};
