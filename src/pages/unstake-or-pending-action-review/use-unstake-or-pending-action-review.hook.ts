import { useMatch, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { usePrices } from "../../hooks/api/use-prices";
import { config } from "../../config";
import { getBaseToken, getTokenPriceInUSD } from "../../domain";
import { Token } from "@stakekit/common";
import { tokenToTokenDto } from "../../utils/mappers";
import { Maybe } from "purify-ts";
import { formatTokenBalance } from "../../utils";
import { useTranslation } from "react-i18next";
import BigNumber from "bignumber.js";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { ActionTypes } from "@stakekit/api-hooks";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";

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
        formatTokenBalance(new BigNumber(val.amount ?? 0), 6)
      )
    : unstake.chain((u) => u.amount).map((val) => formatTokenBalance(val, 6));

  const text = integrationData.map((d) => {
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

  const pendingActionText = pendingActionType.map((type) =>
    t(
      `position_details.pending_action_button.${
        type.toLowerCase() as Lowercase<ActionTypes>
      }`
    )
  );

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

  const tokenNetwork = integrationData.mapOrDefault((d) => d.token.network, "");

  const fee = useMemo(
    () =>
      txGas
        .chain((setg) => gasFeeInUSD.map((gfiu) => ({ setg, gfiu })))
        .mapOrDefault(
          ({ gfiu, setg }) =>
            `${setg.toPrecision(5)} ${tokenNetwork} ($${formatTokenBalance(
              gfiu,
              6
            )})`,
          ""
        ),
    [gasFeeInUSD, txGas, tokenNetwork]
  );

  const onClick = () => {
    navigate("../steps", { relative: "path" });
  };

  return {
    integrationData,
    text,
    amount,
    onClick,
    fee,
    pendingActionMatch,
    pendingActionText,
    pendingActionType,
  };
};
