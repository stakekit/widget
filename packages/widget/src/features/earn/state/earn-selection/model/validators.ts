import type { EarnValidator } from "../../../../../domain/earn/models";
import { validatorAddressIdentity } from "../../../../../domain/earn/validator";
import type { EarnEntry } from "../types";

const sameValidator = (
  network: string,
  first: EarnValidator,
  second: EarnValidator
) =>
  validatorAddressIdentity(network, first.address) ===
    validatorAddressIdentity(network, second.address) &&
  first.subnet?.id === second.subnet?.id;

export const resolveValidators = ({
  complete,
  entry,
  network,
  selectedValidators,
  validatorOptions,
}: {
  readonly complete: boolean;
  readonly entry: EarnEntry;
  readonly network: string;
  readonly selectedValidators: ReadonlyArray<EarnValidator> | null;
  readonly validatorOptions: ReadonlyArray<EarnValidator>;
}) => {
  if (selectedValidators?.length) {
    return selectedValidators.flatMap((selected) => {
      const current = validatorOptions.find((option) =>
        sameValidator(network, option, selected)
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
          validatorAddressIdentity(network, validator.address) ===
            validatorAddressIdentity(network, entry.initParams?.validator ?? "")
      )
    : undefined;

  if (initialValidator) return [initialValidator];
  return validatorOptions.slice(0, 1);
};
