import type { EarnValidator } from "../../../../../domain/earn/models";
import { validatorAddressIdentity } from "../../../../../domain/earn/validator";
import type { EarnEntry } from "../types";

const sameValidator = (first: EarnValidator, second: EarnValidator) =>
  validatorAddressIdentity(first.address) ===
    validatorAddressIdentity(second.address) &&
  first.subnet?.id === second.subnet?.id;

export const resolveValidators = ({
  complete,
  entry,
  selectedValidators,
  validatorOptions,
}: {
  readonly complete: boolean;
  readonly entry: EarnEntry;
  readonly selectedValidators: ReadonlyArray<EarnValidator> | null;
  readonly validatorOptions: ReadonlyArray<EarnValidator>;
}) => {
  if (selectedValidators?.length) {
    return selectedValidators.flatMap((selected) => {
      const current = validatorOptions.find((option) =>
        sameValidator(option, selected)
      );
      if (current) return [current];
      return complete ? [] : [selected];
    });
  }
  if (validatorOptions.length === 0) return [];

  const initialValidator = entry.initParams?.validator
    ? validatorOptions.find(
        (validator) =>
          validator.name?.toLowerCase() ===
            entry.initParams?.validator?.toLowerCase() ||
          validatorAddressIdentity(validator.address) ===
            validatorAddressIdentity(entry.initParams?.validator ?? "")
      )
    : undefined;

  if (initialValidator) return [initialValidator];
  return validatorOptions.slice(0, 1);
};
