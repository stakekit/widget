import type { SelectModalProps } from "@sk-widget/components/atoms/select-modal";
import type { Action } from "@sk-widget/types/utils";
import type {
  PendingActionDto,
  ValidatorDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import { useCallback, useMemo, useReducer } from "react";

type State = {
  selectedValidators: Set<ValidatorDto["address"]>;
  multiSelect: boolean;
} & (
  | {
      showValidatorsModal: true;
      yieldBalance: YieldBalanceDto;
      pendingActionDto: PendingActionDto;
    }
  | {
      showValidatorsModal: false;
      yieldBalance: null;
      pendingActionDto: null;
    }
);

type ValidatorOpenAction = Action<
  "validator/open",
  { yieldBalance: YieldBalanceDto; pendingActionDto: PendingActionDto }
>;
type ValidatorCloseAction = Action<"validator/close">;
type ValidatorMultiSelectAction = Action<
  "validator/multiselect",
  ValidatorDto["address"]
>;
type ValidatorSelectAction = Action<
  "validator/select",
  ValidatorDto["address"]
>;

type Actions =
  | ValidatorOpenAction
  | ValidatorCloseAction
  | ValidatorSelectAction
  | ValidatorMultiSelectAction;

const reducer = (state: State, action: Actions): State => {
  switch (action.type) {
    case "validator/multiselect": {
      const newSet = new Set(state.selectedValidators);

      if (newSet.has(action.data)) {
        newSet.delete(action.data);
      } else {
        newSet.add(action.data);
      }

      if (newSet.size === 0) return state;

      return {
        ...state,
        selectedValidators: newSet,
      };
    }

    case "validator/select": {
      const selectedValidators = new Set([action.data]);

      return {
        ...state,
        selectedValidators,
      };
    }

    case "validator/close": {
      return {
        ...state,
        multiSelect: false,
        pendingActionDto: null,
        yieldBalance: null,
        showValidatorsModal: false,
      };
    }

    case "validator/open": {
      const newSelectedValidators: State["selectedValidators"] = new Set(
        action.data.yieldBalance.validatorAddresses
      );

      return {
        ...state,
        multiSelect:
          !!action.data.pendingActionDto.args?.args?.validatorAddresses
            ?.required,
        selectedValidators: newSelectedValidators,
        pendingActionDto: action.data.pendingActionDto,
        yieldBalance: action.data.yieldBalance,
        showValidatorsModal: true,
      };
    }

    default:
      return state;
  }
};

const getInitialState = (): State => ({
  selectedValidators: new Set(),
  showValidatorsModal: false,
  pendingActionDto: null,
  yieldBalance: null,
  multiSelect: false,
});

export const useValidatorAddressesHandling = () => {
  const [state, dispatch] = useReducer(reducer, getInitialState());

  const closeModal = useCallback(
    () => dispatch({ type: "validator/close" }),
    []
  );

  const openModal = useCallback(
    (args: {
      yieldBalance: YieldBalanceDto;
      pendingActionDto: PendingActionDto;
    }) => dispatch({ type: "validator/open", data: args }),
    []
  );

  const onItemClick = useCallback(
    (validator: ValidatorDto["address"]) =>
      dispatch({ type: "validator/multiselect", data: validator }),
    []
  );

  const modalState: SelectModalProps["state"] = useMemo(
    () => ({
      isOpen: state.showValidatorsModal,
      setOpen: (value) => !value && closeModal(),
    }),
    [closeModal, state.showValidatorsModal]
  );

  return {
    ...state,
    modalState,
    closeModal,
    openModal,
    onItemClick,
    submitDisabled: state.selectedValidators.size === 0,
  };
};
