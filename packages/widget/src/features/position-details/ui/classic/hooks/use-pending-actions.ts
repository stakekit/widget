import BigNumber from "bignumber.js";
import { Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import {
  getTokenPriceInUSD,
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../../domain";
import type { PendingAction } from "../../../../../domain/schema/action-models";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import { isPendingActionAmountRequired } from "../../../../../domain/types/pending-action";

import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import { defaultFormattedNumber } from "../../../../../shared/lib";
import { usePendingActionSelectValidatorMatch } from "../../../../../shared/react/navigation/use-pending-action-select-validator-match";
import {
  getPositionDetailsPendingActionReviewPath,
  useUnstakeOrPendingActionParams,
} from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useTrackEvent } from "../../../../tracking";
import { useSetPendingActionRequest } from "../../../../transaction-flow";
import { useSKWallet } from "../../../../wallet";
import type {
  Actions,
  ExtraData,
  PendingActionAmountChange,
  State,
} from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";
import { preparePendingActionRequestDto } from "./utils";

export const usePendingActions = ({
  dispatch: pendingActionDispatch,
  workflow,
}: {
  readonly dispatch: (action: Actions) => void;
  readonly workflow: State & ExtraData;
}) => {
  const {
    pendingActions: pendingActionsState,
    reducedStakedOrLiquidBalance,
    pendingActionType,
    positionBalancesByType,
    integrationData,
    positionBalancePrices,
  } = workflow;
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();
  const { plain } = useUnstakeOrPendingActionParams();
  const baseToken = integrationData?.token ?? null;
  const positionBalancePricesValue = AsyncResult.getOrElse(
    positionBalancePrices,
    () => null
  );

  const pendingActions = useMemo(
    () =>
      positionBalancesByType
        ? [...positionBalancesByType.values()].flatMap((balances) =>
            balances.flatMap((balance) =>
              balance.pendingActions.map((pendingActionDto) => {
                const amount = isPendingActionAmountRequired(pendingActionDto)
                  ? (pendingActionsState.get(
                      getBalanceTokenActionType({
                        balanceType: balance.type,
                        token: balance.token,
                        actionType: pendingActionDto.type,
                      })
                    ) ?? new BigNumber(0))
                  : null;
                const formattedAmount =
                  positionBalancePricesValue &&
                  amount &&
                  reducedStakedOrLiquidBalance &&
                  baseToken
                    ? `$${defaultFormattedNumber(
                        getTokenPriceInUSD({
                          amount,
                          token: reducedStakedOrLiquidBalance.token,
                          prices: positionBalancePricesValue,
                          pricePerShare: null,
                          baseToken,
                        })
                      )}`
                    : "";

                return {
                  amount,
                  formattedAmount,
                  pendingActionDto,
                  yieldBalance: balance,
                };
              })
            )
          )
        : null,
    [
      pendingActionsState,
      positionBalancePricesValue,
      positionBalancesByType,
      reducedStakedOrLiquidBalance,
      baseToken,
    ]
  );

  const onPendingActionAmountChange = (
    data: PendingActionAmountChange["data"]
  ) => pendingActionDispatch({ type: "pendingAction/amount/change", data });

  const validatorAddressesHandling = useValidatorAddressesHandling();
  const validatorAddressesHandlingRef = useSavedRef(validatorAddressesHandling);
  const selectValidatorModalShown = useRef(false);

  useEffect(() => {
    if (selectValidatorModalShown.current) return;

    const pendingAction =
      pendingActionType && pendingActions
        ? pendingActions.find(
            (item) =>
              item.pendingActionDto.type === pendingActionType &&
              (PAMultiValidatorsRequired(item.pendingActionDto) ||
                PASingleValidatorRequired(item.pendingActionDto))
          )
        : null;

    if (pendingAction) {
      selectValidatorModalShown.current = true;
      validatorAddressesHandlingRef.current.openModal({
        pendingActionDto: pendingAction.pendingActionDto,
        yieldBalance: pendingAction.yieldBalance,
      });
    }
  }, [pendingActionType, pendingActions, validatorAddressesHandlingRef]);

  const { additionalAddresses, address } = useSKWallet();
  const pendingActionSelectValidatorMatch =
    usePendingActionSelectValidatorMatch();
  const setPendingActionRequest = useSetPendingActionRequest();

  const continuePendingActionFlow = ({
    integrationData: selectedYield,
    pendingActionDto,
    yieldBalance,
    selectedValidators,
  }: {
    integrationData: EarnYieldWithProvider;
    pendingActionDto: PendingAction;
    yieldBalance: EarnBalance;
    selectedValidators: ValidatorDto["address"][];
  }) => {
    const prepared = preparePendingActionRequestDto({
      pendingActionsState,
      yieldBalance,
      pendingActionDto,
      additionalAddresses,
      address,
      integration: selectedYield,
      selectedValidators,
    });
    if (Result.isSuccess(prepared)) {
      const value = prepared.success;
      setPendingActionRequest({
        actionDto: null,
        gasFeeToken: value.gasFeeToken,
        integrationData: value.integrationData,
        interactedToken: yieldBalance.token,
        pendingActionType: pendingActionDto.type,
        requestDto: value.requestDto,
        addresses: {
          address: value.address,
          additionalAddresses: value.additionalAddresses,
        },
      });

      const reviewPath = getPositionDetailsPendingActionReviewPath(plain);
      if (reviewPath) {
        navigate(reviewPath);
      } else if (pendingActionSelectValidatorMatch) {
        navigate("../pending-action/review", { relative: "route" });
      } else {
        navigate("pending-action/review");
      }
    }
  };

  const onPendingActionClick = ({
    yieldBalance,
    pendingActionDto,
  }: {
    pendingActionDto: PendingAction;
    yieldBalance: EarnBalance;
  }) => {
    if (!integrationData) return;

    trackEvent("pendingActionClicked", {
      yieldId: integrationData.id,
      type: pendingActionDto.type,
    });
    if (
      PAMultiValidatorsRequired(pendingActionDto) ||
      PASingleValidatorRequired(pendingActionDto)
    ) {
      validatorAddressesHandling.openModal({ pendingActionDto, yieldBalance });
      return;
    }

    continuePendingActionFlow({
      integrationData,
      pendingActionDto,
      yieldBalance,
      selectedValidators: [],
    });
  };

  const onValidatorsSubmit = (
    selectedValidators: ValidatorDto["address"][]
  ) => {
    if (
      !integrationData ||
      !validatorAddressesHandling.showValidatorsModal ||
      !selectedValidators.length
    ) {
      return;
    }

    const { pendingActionDto, yieldBalance } = validatorAddressesHandling;
    trackEvent("validatorsSubmitted", {
      yieldId: integrationData.id,
      type: pendingActionDto.type,
      validators: selectedValidators,
    });
    validatorAddressesHandling.closeModal();
    continuePendingActionFlow({
      integrationData,
      pendingActionDto,
      yieldBalance,
      selectedValidators,
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
