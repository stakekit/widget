import type { EarnValidator } from "../../../../../domain/earn/models";
import type { EarnEntry } from "../types";

export const resolveValidators = ({
  entry,
  selectedValidators,
  validatorOptions,
}: {
  entry: EarnEntry;
  selectedValidators: ReadonlyArray<EarnValidator> | null;
  validatorOptions: ReadonlyArray<EarnValidator>;
}) => {
  if (selectedValidators?.length) return selectedValidators;
  if (validatorOptions.length === 0) return [];

  const initialValidator = entry.initParams?.validator
    ? validatorOptions.find(
        (validator) =>
          validator.name?.toLowerCase() ===
            entry.initParams?.validator?.toLowerCase() ||
          validator.address === entry.initParams?.validator
      )
    : undefined;

  if (initialValidator) return [initialValidator];
  return validatorOptions.slice(0, 1);
};
