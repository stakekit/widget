import { Data, Array as EArray, Option, Result } from "effect";
import {
  getPendingActionStateKey,
  type PendingActionStateKey,
  preparePendingActionCommand,
} from "../../../domain/action/action-command";
import {
  ActionCommand,
  type PendingAction,
} from "../../../domain/action/models";
import {
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "../../../domain/action/pending-action";
import type { ExitReceiveToken } from "../../../domain/action/rules";
import type {
  EarnBalance,
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import { getYieldActionArg } from "../../../domain/earn/yield";
import type { WalletAddress } from "../../../domain/identity/identifiers";
import type { Token } from "../../../domain/token/token";
import type { AdditionalAddresses } from "../../../domain/wallet/address";

class PendingActionAttemptId extends Data.Class<{
  readonly value: string;
}> {}

type PendingActionSelection = Readonly<{
  readonly pendingAction: PendingAction;
  readonly yieldBalance: EarnBalance;
}>;

export type PendingActionModalState =
  | Readonly<{
      readonly _tag: "Closed";
      readonly attemptId: null;
      readonly multiSelect: false;
      readonly pendingAction: null;
      readonly selectedValidators: Set<EarnValidator["address"]>;
    }>
  | Readonly<{
      readonly _tag: "Open";
      readonly attemptId: PendingActionAttemptId;
      readonly multiSelect: boolean;
      readonly pendingAction: PendingActionSelection;
      readonly selectedValidators: Set<EarnValidator["address"]>;
    }>;

export type PendingActionModalStore = Readonly<{
  readonly explicit: boolean;
  readonly nextRevision: number;
  readonly state: PendingActionModalState;
}>;

export type PendingActionSubmissionReceipt = Readonly<{
  readonly _tag: "Started";
  readonly attemptId: PendingActionAttemptId;
}>;

export const closedPendingActionModalState: PendingActionModalState = {
  _tag: "Closed",
  attemptId: null,
  multiSelect: false,
  pendingAction: null,
  selectedValidators: new Set(),
};

export const makePendingActionModalStore = (): PendingActionModalStore => ({
  explicit: false,
  nextRevision: 1,
  state: closedPendingActionModalState,
});

const makeOpenPendingActionModalState = ({
  attemptId,
  pendingAction,
  yieldBalance,
}: PendingActionSelection & {
  readonly attemptId: PendingActionAttemptId;
}): PendingActionModalState => ({
  _tag: "Open",
  attemptId,
  multiSelect: isPendingActionValidatorAddressesRequired(pendingAction),
  pendingAction: { pendingAction, yieldBalance },
  selectedValidators: new Set([
    ...(yieldBalance.validators?.map((validator) => validator.address) ?? []),
    ...(yieldBalance.validator?.address
      ? [yieldBalance.validator.address]
      : []),
  ]),
});

export const openPendingActionModal = ({
  input,
  store,
}: {
  readonly input: PendingActionSelection;
  readonly store: PendingActionModalStore;
}): PendingActionModalStore => ({
  explicit: true,
  nextRevision: store.nextRevision + 1,
  state: makeOpenPendingActionModalState({
    ...input,
    attemptId: new PendingActionAttemptId({
      value: `explicit:${store.nextRevision}`,
    }),
  }),
});

export const makeAutomaticPendingActionModalState = (
  input: PendingActionSelection
): PendingActionModalState =>
  makeOpenPendingActionModalState({
    ...input,
    attemptId: new PendingActionAttemptId({
      value: JSON.stringify([
        "automatic",
        input.yieldBalance.address,
        input.yieldBalance.type,
        input.pendingAction.intent,
        input.pendingAction.type,
        input.pendingAction.passthrough,
        input.pendingAction.amount ?? null,
      ]),
    }),
  });

export const closePendingActionModal = (
  store: PendingActionModalStore
): PendingActionModalStore => ({
  ...store,
  explicit: true,
  state: closedPendingActionModalState,
});

export const reconcilePendingActionModalReceipt = ({
  receipt,
  store,
}: {
  readonly receipt: PendingActionSubmissionReceipt | null;
  readonly store: PendingActionModalStore;
}): PendingActionModalStore =>
  store.state._tag === "Open" &&
  receipt?.attemptId.value === store.state.attemptId.value
    ? closePendingActionModal(store)
    : store;

export const togglePendingActionValidator = ({
  store,
  validator,
}: {
  readonly store: PendingActionModalStore;
  readonly validator: EarnValidator["address"];
}): PendingActionModalStore => {
  if (store.state._tag !== "Open") return store;

  const selectedValidators = new Set(store.state.selectedValidators);
  if (store.state.multiSelect && selectedValidators.has(validator)) {
    selectedValidators.delete(validator);
  } else {
    if (!store.state.multiSelect) selectedValidators.clear();
    selectedValidators.add(validator);
  }
  return selectedValidators.size > 0
    ? { ...store, state: { ...store.state, selectedValidators } }
    : store;
};

export const pendingActionNeedsValidatorSelection = (
  pendingAction: PendingAction
): boolean =>
  isPendingActionValidatorAddressesRequired(pendingAction) ||
  isPendingActionValidatorAddressRequired(pendingAction);

type PositionDetailsExitFacts = Readonly<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress;
  readonly amount: { readonly toString: (radix?: number) => string };
  readonly integration: EarnYieldWithProvider;
  readonly receiveToken: ExitReceiveToken | null;
  readonly stakedOrLiquidBalances: ReadonlyArray<EarnBalance>;
  readonly useMaxAmount: boolean;
}>;

const preparePositionDetailsExitAction = (facts: PositionDetailsExitFacts) => {
  const outputToken = facts.receiveToken?.address;

  const optionArguments = (() => {
    const providerArgument = getYieldActionArg(
      facts.integration,
      "exit",
      "providerId"
    );
    const tronResourceArgument = getYieldActionArg(
      facts.integration,
      "exit",
      "tronResource"
    );
    const providerId = providerArgument?.required
      ? providerArgument.options[0]
      : undefined;
    const tronResource = tronResourceArgument?.required
      ? tronResourceArgument.options[0]
      : undefined;
    if (providerArgument?.required && !providerId) return null;
    if (tronResourceArgument?.required && !tronResource) return null;

    return {
      ...(providerId ? { providerId } : {}),
      ...(tronResource ? { tronResource } : {}),
    };
  })();
  if (!optionArguments) return null;

  const validatorArguments = (() => {
    const validatorAddressesRequired = Boolean(
      getYieldActionArg(facts.integration, "exit", "validatorAddresses")
        ?.required
    );
    const validatorAddressRequired = Boolean(
      getYieldActionArg(facts.integration, "exit", "validatorAddress")?.required
    );
    const subnetRequired = Boolean(
      getYieldActionArg(facts.integration, "exit", "subnetId")?.required
    );
    if (
      !validatorAddressesRequired &&
      !validatorAddressRequired &&
      !subnetRequired
    ) {
      return {};
    }

    const pluralBalance = validatorAddressesRequired
      ? EArray.findFirst(facts.stakedOrLiquidBalances, (candidate) =>
          Boolean(candidate.validators?.length)
        ).pipe(Option.getOrNull)
      : null;
    const validatorAddresses = pluralBalance?.validators?.map(
      (validator) => validator.address
    );
    if (
      validatorAddressesRequired &&
      (!validatorAddresses || validatorAddresses.length === 0)
    ) {
      return null;
    }

    const singularBalance =
      validatorAddressRequired || subnetRequired
        ? EArray.findFirst(facts.stakedOrLiquidBalances, (candidate) =>
            Boolean(candidate.validator)
          ).pipe(Option.getOrNull)
        : null;
    const validator =
      singularBalance?.validator ?? pluralBalance?.validators?.[0];
    if (validatorAddressRequired && !validator?.address) return null;
    const subnetId = subnetRequired ? validator?.subnet?.id : undefined;
    if (subnetRequired && subnetId === undefined) return null;

    return {
      ...(validatorAddresses ? { validatorAddresses } : {}),
      ...(validatorAddressRequired && validator
        ? { validatorAddress: validator.address }
        : {}),
      ...(subnetId === undefined ? {} : { subnetId }),
    };
  })();
  if (!validatorArguments) return null;

  return {
    gasFeeToken: facts.integration.mechanics.gasFeeToken,
    request: ActionCommand.make({
      address: facts.address,
      arguments: {
        amount: facts.amount.toString(10),
        ...(outputToken ? { outputToken } : {}),
        ...(facts.useMaxAmount ? { useMaxAmount: true } : {}),
        ...optionArguments,
        ...validatorArguments,
        ...(facts.additionalAddresses ?? {}),
      },
      yieldId: facts.integration.id,
    }),
  } as const;
};

export const resolvePositionDetailsExitSubmission = ({
  amountValid,
  canMount,
  facts,
  kycBlocking,
  token,
}: {
  readonly amountValid: boolean;
  readonly canMount: boolean;
  readonly facts: PositionDetailsExitFacts | null;
  readonly kycBlocking: boolean;
  readonly token: Token | null;
}) => {
  const prepared = facts ? preparePositionDetailsExitAction(facts) : null;
  return amountValid && canMount && !kycBlocking && prepared && token
    ? ({ _tag: "Start", prepared, token } as const)
    : ({ _tag: "Invalid" } as const);
};

export type PositionPendingActionCommand =
  | Readonly<{
      readonly _tag: "Select";
      readonly pendingAction: PendingAction;
      readonly yieldBalance: EarnBalance;
    }>
  | Readonly<{ readonly _tag: "SubmitValidators" }>;

type ConnectedPendingActionWallet = Readonly<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress;
}>;

export type PendingActionTelemetry =
  | Readonly<{
      readonly _tag: "PendingActionClicked";
      readonly pendingActionType: PendingAction["type"];
      readonly yieldId: EarnYieldWithProvider["id"];
    }>
  | Readonly<{
      readonly _tag: "ValidatorsSubmitted";
      readonly pendingActionType: PendingAction["type"];
      readonly validators: ReadonlyArray<EarnValidator["address"]>;
      readonly yieldId: EarnYieldWithProvider["id"];
    }>;

export const resolvePositionPendingActionDecision = ({
  canMount,
  command,
  integration,
  modal,
  pendingActionIndex,
  pendingActionsState,
  pendingActionValidations,
  wallet,
}: {
  readonly canMount: boolean;
  readonly command: PositionPendingActionCommand;
  readonly integration: EarnYieldWithProvider | null;
  readonly modal: PendingActionModalState;
  readonly pendingActionIndex: ReadonlyMap<
    PendingActionStateKey,
    Readonly<{
      readonly balance: EarnBalance;
      readonly pendingAction: PendingAction;
    }>
  >;
  readonly pendingActionsState: Parameters<
    typeof preparePendingActionCommand
  >[0]["pendingActionsState"];
  readonly pendingActionValidations: ReadonlyMap<
    PendingActionStateKey,
    "AboveMaximum" | "BelowMinimum" | "Required" | null
  >;
  readonly wallet: ConnectedPendingActionWallet | null;
}) => {
  if (!integration) return { _tag: "Unavailable" } as const;

  const requestedSelection = (() => {
    if (command._tag === "Select") {
      return {
        attemptId: null,
        pendingAction: command.pendingAction,
        selectedValidators: [] as EarnValidator["address"][],
        yieldBalance: command.yieldBalance,
      };
    }
    return modal._tag === "Open"
      ? {
          attemptId: modal.attemptId,
          ...modal.pendingAction,
          selectedValidators: [...modal.selectedValidators],
        }
      : null;
  })();
  if (!requestedSelection) return { _tag: "Unavailable" } as const;

  const pendingActionKey = getPendingActionStateKey({
    actionType: requestedSelection.pendingAction.type,
    balanceType: requestedSelection.yieldBalance.type,
    passthrough: requestedSelection.pendingAction.passthrough,
    token: requestedSelection.yieldBalance.token,
  });
  const current = pendingActionIndex.get(pendingActionKey);
  if (!current || pendingActionValidations.get(pendingActionKey)) {
    return { _tag: "Unavailable" } as const;
  }
  const selection = {
    ...requestedSelection,
    pendingAction: current.pendingAction,
    yieldBalance: current.balance,
  };

  const telemetry: PendingActionTelemetry =
    command._tag === "Select"
      ? {
          _tag: "PendingActionClicked",
          pendingActionType: selection.pendingAction.type,
          yieldId: integration.id,
        }
      : {
          _tag: "ValidatorsSubmitted",
          pendingActionType: selection.pendingAction.type,
          validators: selection.selectedValidators,
          yieldId: integration.id,
        };

  if (
    command._tag === "Select" &&
    pendingActionNeedsValidatorSelection(selection.pendingAction)
  ) {
    return {
      _tag: "Open",
      input: {
        pendingAction: selection.pendingAction,
        yieldBalance: selection.yieldBalance,
      },
      telemetry,
    } as const;
  }

  if (!wallet || !canMount) {
    return { _tag: "Unavailable", telemetry } as const;
  }

  const prepared = preparePendingActionCommand({
    additionalAddresses: wallet.additionalAddresses,
    address: wallet.address,
    integration,
    pendingAction: selection.pendingAction,
    pendingActionsState,
    selectedValidators: selection.selectedValidators,
    yieldBalance: selection.yieldBalance,
  });
  if (Result.isFailure(prepared)) {
    return { _tag: "Unavailable", telemetry } as const;
  }

  return {
    _tag: "Start",
    attemptId: selection.attemptId,
    prepared: prepared.success,
    selection,
    telemetry,
  } as const;
};
