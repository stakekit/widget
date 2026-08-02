import { Data, Array as EArray, Option, Result } from "effect";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../domain";
import {
  ActionCommand,
  type PendingAction,
} from "../../../domain/schema/action-models";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import type {
  EarnBalance,
  EarnToken,
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import { preparePendingActionRequestDto } from "../../../domain/types/pending-action-request";
import { getYieldActionArg } from "../../../domain/types/yields";

class PendingActionAttemptId extends Data.Class<{
  readonly value: string;
}> {}

type PendingActionSelection = Readonly<{
  readonly pendingActionDto: PendingAction;
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
  pendingActionDto,
  yieldBalance,
}: PendingActionSelection & {
  readonly attemptId: PendingActionAttemptId;
}): PendingActionModalState => ({
  _tag: "Open",
  attemptId,
  multiSelect: PAMultiValidatorsRequired(pendingActionDto),
  pendingAction: { pendingActionDto, yieldBalance },
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
        input.pendingActionDto.intent,
        input.pendingActionDto.type,
        input.pendingActionDto.passthrough,
        input.pendingActionDto.amount ?? null,
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
  PAMultiValidatorsRequired(pendingAction) ||
  PASingleValidatorRequired(pendingAction);

type PositionDetailsExitFacts = Readonly<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress;
  readonly amount: { readonly toString: (radix?: number) => string };
  readonly integration: EarnYieldWithProvider;
  readonly stakedOrLiquidBalances: ReadonlyArray<EarnBalance>;
  readonly useMaxAmount: boolean;
}>;

const preparePositionDetailsExitAction = (facts: PositionDetailsExitFacts) => {
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
  readonly token: EarnToken | null;
}) => {
  const prepared = facts ? preparePositionDetailsExitAction(facts) : null;
  return amountValid && canMount && !kycBlocking && prepared && token
    ? ({ _tag: "Start", prepared, token } as const)
    : ({ _tag: "Invalid" } as const);
};

export type PositionPendingActionCommand =
  | Readonly<{
      readonly _tag: "Select";
      readonly pendingActionDto: PendingAction;
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
  pendingActionsState,
  wallet,
}: {
  readonly canMount: boolean;
  readonly command: PositionPendingActionCommand;
  readonly integration: EarnYieldWithProvider | null;
  readonly modal: PendingActionModalState;
  readonly pendingActionsState: Parameters<
    typeof preparePendingActionRequestDto
  >[0]["pendingActionsState"];
  readonly wallet: ConnectedPendingActionWallet | null;
}) => {
  if (!integration) return { _tag: "Unavailable" } as const;

  const selection = (() => {
    if (command._tag === "Select") {
      return {
        attemptId: null,
        pendingActionDto: command.pendingActionDto,
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
  if (!selection) return { _tag: "Unavailable" } as const;

  const telemetry: PendingActionTelemetry =
    command._tag === "Select"
      ? {
          _tag: "PendingActionClicked",
          pendingActionType: selection.pendingActionDto.type,
          yieldId: integration.id,
        }
      : {
          _tag: "ValidatorsSubmitted",
          pendingActionType: selection.pendingActionDto.type,
          validators: selection.selectedValidators,
          yieldId: integration.id,
        };

  if (
    command._tag === "Select" &&
    pendingActionNeedsValidatorSelection(selection.pendingActionDto)
  ) {
    return {
      _tag: "Open",
      input: {
        pendingActionDto: selection.pendingActionDto,
        yieldBalance: selection.yieldBalance,
      },
      telemetry,
    } as const;
  }

  if (!wallet || !canMount) {
    return { _tag: "Unavailable", telemetry } as const;
  }

  const prepared = preparePendingActionRequestDto({
    additionalAddresses: wallet.additionalAddresses,
    address: wallet.address,
    integration,
    pendingActionDto: selection.pendingActionDto,
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
