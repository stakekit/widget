import type {
  PendingActionDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Left, List, Maybe, Right } from "purify-ts";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import {
  getTokenPriceInUSD,
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../domain";
import { usePendingActionSelectValidatorMatch } from "../../../hooks/navigation/use-pending-action-select-validator-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useBaseToken } from "../../../hooks/use-base-token";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { usePendingActionStore } from "../../../providers/pending-action-store";
import { useSKWallet } from "../../../providers/sk-wallet";
import { defaultFormattedNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import type { PendingActionAmountChange } from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";
import { preparePendingActionRequestDto } from "./utils";

export const usePendingActions = () => {
  const {
    pendingActions: pendingActionsState,
    reducedStakedOrLiquidBalance,
    pendingActionType,
    positionBalancesByType,
    integrationData,
    positionBalancePrices,
  } = useUnstakeOrPendingActionState();

  const baseToken = useBaseToken(integrationData);

  const pendingActionDispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const navigate = useNavigate();

  const pendingActions = useMemo(
    () =>
      positionBalancesByType.map((pbbt) =>
        [...pbbt.values()].flatMap((val) =>
          val.flatMap((balance) =>
            balance.pendingActions.map((pa) => {
              const amount = Maybe.fromPredicate(
                (v) => !!v,
                pa.args?.args?.amount?.required
              ).chain(() =>
                Maybe.fromNullable(
                  pendingActionsState.get(
                    getBalanceTokenActionType({
                      balanceType: balance.type,
                      token: balance.token,
                      actionType: pa.type,
                    })
                  )
                ).altLazy(() => Maybe.of(new BigNumber(0)))
              );

              const formattedAmount = Maybe.fromRecord({
                prices: Maybe.fromNullable(positionBalancePrices.data),
                amount,
                reducedStakedOrLiquidBalance,
                baseToken,
              })
                .map((val) =>
                  getTokenPriceInUSD({
                    amount: val.amount,
                    token: val.reducedStakedOrLiquidBalance.token,
                    prices: val.prices,
                    pricePerShare: balance.pricePerShare,
                    baseToken: val.baseToken,
                  })
                )
                .mapOrDefault((v) => `$${defaultFormattedNumber(v)}`, "");

              return {
                amount: amount.extractNullable(),
                formattedAmount,
                pendingActionDto: pa,
                yieldBalance: balance,
              };
            })
          )
        )
      ),
    [
      pendingActionsState,
      positionBalancePrices.data,
      positionBalancesByType,
      reducedStakedOrLiquidBalance,
      baseToken,
    ]
  );

  const onPendingActionAmountChange = (
    data: PendingActionAmountChange["data"]
  ) => {
    pendingActionDispatch({ type: "pendingAction/amount/change", data });
  };

  const validatorAddressesHandling = useValidatorAddressesHandling();

  const validatorAddressesHandlingRef = useSavedRef(validatorAddressesHandling);

  const selectValidatorModalShown = useRef(false);

  /**
   * On deep link, find pending action with validators requirement
   * and open validator selection modal
   */
  useEffect(() => {
    if (selectValidatorModalShown.current) return;

    pendingActionType
      .chain((val) =>
        pendingActions.chain((pa) =>
          List.find(
            (p) =>
              p.pendingActionDto.type === val &&
              !!(
                PAMultiValidatorsRequired(p.pendingActionDto) ||
                PASingleValidatorRequired(p.pendingActionDto)
              ),
            pa
          )
        )
      )
      .ifJust((val) => {
        selectValidatorModalShown.current = true;
        validatorAddressesHandlingRef.current.openModal({
          pendingActionDto: val.pendingActionDto,
          yieldBalance: val.yieldBalance,
        });
      });
  }, [pendingActionType, pendingActions, validatorAddressesHandlingRef]);

  const onPendingActionClick = ({
    yieldBalance,
    pendingActionDto,
  }: {
    pendingActionDto: PendingActionDto;
    yieldBalance: YieldBalanceDto;
  }) => {
    trackEvent("pendingActionClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
      type: pendingActionDto.type,
    });
    if (
      PAMultiValidatorsRequired(pendingActionDto) ||
      PASingleValidatorRequired(pendingActionDto)
    ) {
      return validatorAddressesHandling.openModal({
        pendingActionDto,
        yieldBalance,
      });
    }

    integrationData
      .toEither(new Error("missing integration data"))
      .ifRight((val) =>
        continuePendingActionFlow({
          integrationData: val,
          pendingActionDto,
          yieldBalance,
          selectedValidators: [],
        })
      );
  };

  const onValidatorsSubmit = (selectedValidators: string[]) => {
    return integrationData
      .toEither(new Error("missing integration data"))
      .chain((val) => {
        if (!validatorAddressesHandling.showValidatorsModal) {
          return Left(
            new Error("missing validatorAddressesHandling.showValidatorsModal")
          );
        }
        if (!selectedValidators.length) {
          return Left(new Error("selectedValidators is empty"));
        }

        const { pendingActionDto, yieldBalance } = validatorAddressesHandling;

        return Right({
          yieldDto: val,
          selectedValidators,
          pendingActionDto,
          yieldBalance,
        });
      })
      .ifRight(
        ({ selectedValidators, pendingActionDto, yieldBalance, yieldDto }) => {
          trackEvent("validatorsSubmitted", {
            yieldId: yieldDto.id,
            type: pendingActionDto.type,
            validators: selectedValidators,
          });

          validatorAddressesHandling.closeModal();

          continuePendingActionFlow({
            integrationData: yieldDto,
            pendingActionDto,
            yieldBalance,
            selectedValidators,
          });
        }
      );
  };

  const { additionalAddresses, address } = useSKWallet();

  const pendingActionSelectValidatorMatch =
    usePendingActionSelectValidatorMatch();

  const pendingActionStore = usePendingActionStore();

  const continuePendingActionFlow = ({
    integrationData,
    pendingActionDto,
    yieldBalance,
    selectedValidators,
  }: {
    integrationData: YieldDto;
    pendingActionDto: PendingActionDto;
    yieldBalance: YieldBalanceDto;
    selectedValidators: ValidatorDto["address"][];
  }) => {
    preparePendingActionRequestDto({
      pendingActionsState,
      yieldBalance,
      pendingActionDto,
      additionalAddresses,
      address,
      integration: integrationData,
      selectedValidators,
    }).ifRight((val) => {
      pendingActionStore.send({
        type: "initFlow",
        data: {
          gasFeeToken: val.gasFeeToken,
          integrationData: val.integrationData,
          interactedToken: yieldBalance.token,
          pendingActionType: pendingActionDto.type,
          requestDto: val.requestDto,
          addresses: {
            address: val.address,
            additionalAddresses: val.additionalAddresses,
          },
        },
      });

      pendingActionSelectValidatorMatch
        ? navigate("../pending-action/review", { relative: "route" })
        : navigate("pending-action/review");
    });
  };

  return {
    onPendingActionAmountChange,
    validatorAddressesHandling,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
  };
};
