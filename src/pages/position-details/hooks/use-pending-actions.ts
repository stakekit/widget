import { useEffect, useMemo, useRef } from "react";
import { useOnPendingAction } from "./use-on-pending-action";
import { Left, List, Maybe, Right } from "purify-ts";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
  getTokenPriceInUSD,
} from "../../../domain";
import { useSavedRef } from "../../../hooks";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";
import type {
  ActionTypes,
  PendingActionDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { preparePendingActionRequestDto } from "./utils";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useNavigate } from "react-router-dom";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../../../state/unstake-or-pending-action";
import BigNumber from "bignumber.js";
import { formatNumber } from "../../../utils";
import { useUpdateEffect } from "../../../hooks/use-update-effect";
import { usePendingActionSelectValidatorMatch } from "../../../hooks/navigation/use-pending-action-select-validator-match";

export const usePendingActions = () => {
  const {
    pendingActions: pendingActionsState,
    reducedStakedOrLiquidBalance,
    pendingActionType,
    positionBalancesByType,
    integrationData,
    positionBalancePrices,
  } = useUnstakeOrPendingActionState();

  const pendingActionSelectValidatorMatchRef = useSavedRef(
    usePendingActionSelectValidatorMatch()
  );

  const pendingActionDispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const navigate = useNavigate();

  const onPendingAction = useOnPendingAction();

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
                Maybe.fromNullable(pendingActionsState.get(pa.type)).altLazy(
                  () => Maybe.of(new BigNumber(0))
                )
              );

              const formattedAmount = Maybe.fromRecord({
                prices: Maybe.fromNullable(positionBalancePrices.data),
                amount,
                reducedStakedOrLiquidBalance,
              })
                .map((val) =>
                  getTokenPriceInUSD({
                    amount: val.amount,
                    token: val.reducedStakedOrLiquidBalance.token,
                    prices: val.prices,
                    pricePerShare:
                      val.reducedStakedOrLiquidBalance.pricePerShare,
                  })
                )
                .mapOrDefault((v) => `$${formatNumber(v, 2)}`, "");

              return {
                amount: amount.extractNullable(),
                formattedAmount,
                pendingActionDto: pa,
                yieldBalance: balance,
                isLoading:
                  onPendingAction.variables?.pendingActionRequestDto
                    .passthrough === pa.passthrough &&
                  onPendingAction.variables?.pendingActionRequestDto.type ===
                    pa.type &&
                  onPendingAction.isPending,
              };
            })
          )
        )
      ),
    [
      onPendingAction.isPending,
      onPendingAction.variables?.pendingActionRequestDto.passthrough,
      onPendingAction.variables?.pendingActionRequestDto.type,
      pendingActionsState,
      positionBalancePrices.data,
      positionBalancesByType,
      reducedStakedOrLiquidBalance,
    ]
  );

  const onPendingActionAmountChange = (
    type: ActionTypes,
    amount: BigNumber
  ) => {
    pendingActionDispatch({
      type: "pendingAction/amount/change",
      data: { actionType: type, amount },
    });
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
        } else if (!selectedValidators.length) {
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
    }).ifRight((val) =>
      onPendingAction.mutate({ pendingActionRequestDto: val, yieldBalance })
    );
  };

  useUpdateEffect(() => {
    if (onPendingAction.isSuccess && onPendingAction.data) {
      !!pendingActionSelectValidatorMatchRef.current
        ? navigate("../pending-action/review", { relative: "route" })
        : navigate("pending-action/review");
    }
  }, [onPendingAction.isSuccess, onPendingAction.data]);

  return {
    onPendingActionAmountChange,
    validatorAddressesHandling,
    pendingActions,
    onPendingAction,
    onPendingActionClick,
    onValidatorsSubmit,
  };
};
