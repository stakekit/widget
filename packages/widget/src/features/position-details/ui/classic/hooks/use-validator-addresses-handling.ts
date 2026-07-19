import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { PendingAction } from "../../../../../domain/schema/action-models";
import type { EarnBalance } from "../../../../../domain/schema/earn-models";
import { isPendingActionValidatorAddressesRequired } from "../../../../../domain/types/pending-action";
import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../../../services/wallet/domain/scope";
import type { Action } from "../../../../../shared/types/utils";
import type { SelectModalProps } from "../../../../widget-shell/ui/select-modal";

type State = {
  selectedValidators: Set<ValidatorDto["address"]>;
  multiSelect: boolean;
} & (
  | {
      showValidatorsModal: true;
      yieldBalance: EarnBalance;
      pendingActionDto: PendingAction;
    }
  | {
      showValidatorsModal: false;
      yieldBalance: null;
      pendingActionDto: null;
    }
);

type ValidatorOpenAction = Action<
  "validator/open",
  { yieldBalance: EarnBalance; pendingActionDto: PendingAction }
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
      const newSelectedValidators: State["selectedValidators"] = new Set([
        ...(action.data.yieldBalance.validators?.map((v) => v.address) ?? []),
        ...(action.data.yieldBalance.validator?.address
          ? [action.data.yieldBalance.validator.address]
          : []),
      ]);

      return {
        ...state,
        multiSelect: isPendingActionValidatorAddressesRequired(
          action.data.pendingActionDto
        ),
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

export const useValidatorAddressesHandling = (walletScope: WalletScopeKey) => {
  const [state, dispatch] = useReducer(reducer, getInitialState());
  const previousWalletScope = useRef(walletScope);

  useLayoutEffect(() => {
    const previous = previousWalletScope.current;
    if (sameWalletScopeOwner(previous, walletScope)) {
      return;
    }

    previousWalletScope.current = walletScope;
    dispatch({ type: "validator/close" });
  }, [walletScope]);

  const closeModal = useCallback(
    () => dispatch({ type: "validator/close" }),
    []
  );

  const openModal = useCallback(
    (args: { yieldBalance: EarnBalance; pendingActionDto: PendingAction }) =>
      dispatch({ type: "validator/open", data: args }),
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
