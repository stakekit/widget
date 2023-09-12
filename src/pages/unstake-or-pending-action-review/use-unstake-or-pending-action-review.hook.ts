import { useMatch, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { usePrices } from "../../hooks/api/use-prices";
import { config } from "../../config";
import { getBaseToken, getTokenPriceInUSD } from "../../domain";
import { Token } from "@stakekit/common";
import { tokenToTokenDto } from "../../utils/mappers";
import { Maybe } from "purify-ts";
import { formatTokenBalance } from "../../utils";
import { usePositionData } from "../../hooks/use-position-data";
import { useTranslation } from "react-i18next";
import BigNumber from "bignumber.js";
import { useStakedOrLiquidBalance } from "../../hooks/use-staked-or-liquid-balance";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { usePositionBalanceByType } from "../../hooks/use-position-balance-by-type";
import { ActionTypes } from "@stakekit/api-hooks";

export const useUnstakeOrPendingActionReview = () => {
  const params = useParams<{
    integrationId: string;
    defaultOrValidatorId: "default" | (string & {});
  }>();

  const integrationId = params.integrationId;
  const defaultOrValidatorId = params.defaultOrValidatorId ?? "default";

  const { position } = usePositionData(integrationId);

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/review"
  );

  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionType = pendingActionSession.map((val) => val.type);

  const { t } = useTranslation();

  /**
   * @summary Position balance by type
   */
  const positionBalancesByType = usePositionBalanceByType(
    position,
    defaultOrValidatorId
  );

  const stakedOrLiquidBalance = useStakedOrLiquidBalance(
    positionBalancesByType
  );

  const amount = pendingActionMatch
    ? pendingActionSession.map((val) =>
        formatTokenBalance(new BigNumber(val.amount ?? 0), 6)
      )
    : unstake.chain((u) => u.amount).map((val) => formatTokenBalance(val, 6));

  const text = position.map((p) => {
    switch (p.integrationData.metadata.type) {
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
    tokenList: stakedOrLiquidBalance.mapOrDefault(
      (sb) => [sb.token, tokenToTokenDto(getBaseToken(sb.token as Token))],
      []
    ),
  });

  const gasFeeInUSD = useMemo(
    () =>
      position
        .chain((p) =>
          Maybe.fromNullable(pricesState.data).map((prices) => ({ prices, p }))
        )
        .chain((val) =>
          txGas.map((gas) => ({
            ...val,
            gas,
          }))
        )
        .map(({ prices, p, gas }) =>
          getTokenPriceInUSD({
            amount: gas.toString(),
            prices,
            token: getBaseToken(p.integrationData.token as Token),
            pricePerShare: undefined,
          })
        ),
    [position, pricesState.data, txGas]
  );

  const tokenNetwork = position.mapOrDefault(
    (p) => p.integrationData.token.network,
    ""
  );

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
    text,
    amount,
    position,
    onClick,
    fee,
    pendingActionMatch,
    pendingActionText,
    pendingActionType,
  };
};
