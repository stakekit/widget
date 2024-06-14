import { usePendingActionSelectValidatorMatch } from "@sk-widget/hooks/navigation/use-pending-action-select-validator-match";
import {
  usePendingStakeRequestDto,
  usePendingStakeRequestDtoDispatch,
} from "@sk-widget/providers/pending-stake-request-dto";
import type {
  PendingActionDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Left, List, Maybe, Right } from "purify-ts";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
  getTokenPriceInUSD,
} from "../../../domain";
import { useSavedRef } from "../../../hooks";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useBaseToken } from "../../../hooks/use-base-token";
import { useUpdateEffect } from "../../../hooks/use-update-effect";
import { useSKWallet } from "../../../providers/sk-wallet";
import { formatNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import type { PendingActionAmountChange } from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";
import { useOnPendingAction } from "./use-on-pending-action";
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

  const setPendingDto = usePendingStakeRequestDtoDispatch();
  const pendingDto = usePendingStakeRequestDto();

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
      setPendingDto({
        ...val,
        address,
        pendingActionType,
        pendingActionData: {
          integrationData: integrationData,
          interactedToken: yieldBalance.token,
        },
      })
    );
  };
  const pendingActionSelectValidatorMatchRef = useSavedRef(
    usePendingActionSelectValidatorMatch()
  );
  useUpdateEffect(() => {
    if (pendingDto) {
      pendingActionSelectValidatorMatchRef.current
        ? navigate("../pending-action/review", { relative: "route" })
        : navigate("pending-action/review");
    }
  }, [pendingDto]);

  return {
    onPendingActionAmountChange,
    validatorAddressesHandling,
    pendingActions,
    onPendingAction,
    onPendingActionClick,
    onValidatorsSubmit,
  };
};
