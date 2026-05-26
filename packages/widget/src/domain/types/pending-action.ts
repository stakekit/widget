import type { PendingActionDto as LegacyPendingActionDto } from "../../generated/api/legacy";
import type {
  CreateManageActionDto,
  PendingActionDto as YieldPendingActionDtoGenerated,
} from "../../generated/api/yield";

export type YieldPendingActionDto = YieldPendingActionDtoGenerated;
export type YieldPendingActionType =
  | YieldPendingActionDto["type"]
  | NonNullable<CreateManageActionDto["action"]>;

type PendingActionArgName =
  | "amount"
  | "validatorAddress"
  | "validatorAddresses";

export type AnyPendingActionDto =
  | LegacyPendingActionDto
  | YieldPendingActionDto;

type PendingActionAmountConfig = {
  required: boolean;
  minimum: number | null;
  maximum: number | null;
  forceMax: boolean;
};

export const isPendingActionAmountRequired = (
  pendingAction: AnyPendingActionDto
) => !!getPendingActionAmountConfig(pendingAction)?.required;

export const isPendingActionValidatorAddressRequired = (
  pendingAction: AnyPendingActionDto
) => !!getPendingActionArgument(pendingAction, "validatorAddress")?.required;

export const isPendingActionValidatorAddressesRequired = (
  pendingAction: AnyPendingActionDto
) => !!getPendingActionArgument(pendingAction, "validatorAddresses")?.required;

export const getPendingActionAmountConfig = (
  pendingAction: AnyPendingActionDto
): PendingActionAmountConfig | null => {
  const amountArg = getPendingActionArgument(pendingAction, "amount");

  if (!amountArg) {
    return null;
  }

  const minimum = toNumberOrNull(amountArg.minimum);
  const maximum = toNumberOrNull(amountArg.maximum);

  return {
    required: !!amountArg.required,
    minimum,
    maximum,
    forceMax: minimum === -1 && maximum === -1,
  };
};

const getPendingActionArgument = (
  pendingAction: AnyPendingActionDto,
  name: PendingActionArgName
) => {
  const v2Field = (
    pendingAction as YieldPendingActionDto
  ).arguments?.fields?.find(
    (
      field: NonNullable<YieldPendingActionDto["arguments"]>["fields"][number]
    ) => field.name === name
  );

  if (v2Field) {
    return {
      required: !!v2Field.required,
      minimum: v2Field.minimum ?? null,
      maximum: v2Field.maximum ?? null,
    };
  }

  const legacyField = (pendingAction as LegacyPendingActionDto).args?.args?.[
    name
  ] as
    | {
        required?: boolean;
        minimum?: number | string | null;
        maximum?: number | string | null;
      }
    | undefined;

  if (!legacyField) {
    return null;
  }

  return {
    required: !!legacyField.required,
    minimum: legacyField.minimum ?? null,
    maximum: legacyField.maximum ?? null,
  };
};

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
