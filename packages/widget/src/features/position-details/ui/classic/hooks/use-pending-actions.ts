import BigNumber from "bignumber.js";
import { Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../../domain";
import type { PendingAction } from "../../../../../domain/schema/action-models";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import { isPendingActionAmountRequired } from "../../../../../domain/types/pending-action";
import {
  getBalanceTokenActionType,
  preparePendingActionRequestDto,
} from "../../../../../domain/types/pending-action-request";
import { getTokenPriceInUSD } from "../../../../../domain/types/price";

import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../../services/workflow/transaction-workflow-model";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { usePendingActionSelectValidatorMatch } from "../../../../../shared/react/navigation/use-pending-action-select-validator-match";
import {
  getPositionDetailsPendingActionReviewPath,
  useUnstakeOrPendingActionParams,
} from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useStartClassicTransactionFlow } from "../../../../classic-transaction-flow/react/use-transaction-flow";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import { useSKWallet } from "../../../../wallet/react/use-wallet";
import type {
  PositionDetailsWorkflowAction as Actions,
  PendingActionAmountChange,
  PositionDetailsWorkflowState as State,
} from "../../../state/workflow";
import type { ExtraData } from "../state/types";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";

export const usePendingActions = ({
  dispatch: pendingActionDispatch,
  providersDetails,
  workflow,
}: {
  readonly dispatch: (action: Actions) => void;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly workflow: State & ExtraData;
}) => {
  const {
    pendingActions: pendingActionsState,
    reducedStakedOrLiquidBalance,
    pendingActionType,
    positionBalancesByType,
    integrationData,
    positionBalancePrices,
    currentWalletScope,
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

  const validatorAddressesHandling =
    useValidatorAddressesHandling(currentWalletScope);
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
  const startClassicTransactionFlow = useStartClassicTransactionFlow();

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
      startClassicTransactionFlow({
        _tag: "Manage",
        gasFeeToken: value.gasFeeToken,
        integration: value.integrationData,
        interactedToken: yieldBalance.token,
        pendingActionType: pendingActionDto.type,
        providersDetails,
        request: value.requestDto,
        walletScope: currentWalletScope,
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
