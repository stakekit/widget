import type { ValidatorDto } from "../../generated/api/yield";

export type ValidatorKey = string;

export type Validator = ValidatorDto & {
  readonly key: ValidatorKey;
};

const getValidatorKey = (
  validator: Pick<ValidatorDto, "address" | "subnet">
): ValidatorKey =>
  validator.subnet?.id === undefined
    ? validator.address
    : `${validator.address}:${validator.subnet.id}`;

export const toValidator = (validator: ValidatorDto): Validator => ({
  ...validator,
  key: getValidatorKey(validator),
});

export const toValidators = (
  validators: ReadonlyArray<ValidatorDto>
): Validator[] => validators.map(toValidator);
