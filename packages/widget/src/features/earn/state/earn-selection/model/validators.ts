import type { EarnValidator } from "../../../../../domain/earn/models";
import { validatorAddressIdentity } from "../../../../../domain/earn/validator";

const sameValidator = (first: EarnValidator, second: EarnValidator) =>
  validatorAddressIdentity(first.address) ===
    validatorAddressIdentity(second.address) &&
  first.subnet?.id === second.subnet?.id;

/** Matches an init-param validator against a validator's name or address. */
export const matchesRequestedValidator = (
  validator: EarnValidator,
  requested: string
) =>
  validator.name?.toLowerCase() === requested.toLowerCase() ||
  validatorAddressIdentity(validator.address) ===
    validatorAddressIdentity(requested);

/**
 * A requested validator wins over the default; when neither the catalog nor
 * the directory lookup (`requestedMatch`) has it, the selection stays empty so
 * the user picks one explicitly.
 */
export const resolveValidators = ({
  complete,
  requestedMatch,
  requestedValidator,
  selectedValidators,
  validatorOptions,
}: {
  readonly complete: boolean;
  readonly requestedMatch: EarnValidator | null;
  readonly requestedValidator: string | null;
  readonly selectedValidators: ReadonlyArray<EarnValidator> | null;
  readonly validatorOptions: ReadonlyArray<EarnValidator>;
}): ReadonlyArray<EarnValidator> => {
  if (selectedValidators?.length) {
    return selectedValidators.flatMap((selected) => {
      const current = validatorOptions.find((option) =>
        sameValidator(option, selected)
      );
      if (current) return [current];
      return complete ? [] : [selected];
    });
  }

  if (requestedValidator) {
    const initialValidator =
      validatorOptions.find((validator) =>
        matchesRequestedValidator(validator, requestedValidator)
      ) ?? requestedMatch;
    return initialValidator ? [initialValidator] : [];
  }

  return validatorOptions.slice(0, 1);
};
