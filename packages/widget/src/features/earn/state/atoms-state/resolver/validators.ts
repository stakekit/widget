import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../../../domain/schema/earn-models";
import type { EarnEntry } from "../types";

export const resolveValidators = ({
  entry,
  selectedValidatorKeys,
  validatorOptions,
}: {
  entry: EarnEntry;
  selectedValidatorKeys: ReadonlySet<EarnValidatorKey>;
  validatorOptions: ReadonlyArray<EarnValidator>;
}) => {
  if (validatorOptions.length === 0) {
    return [];
  }

  const selectedValidators = validatorOptions.filter((validator) =>
    selectedValidatorKeys.has(validator.key)
  );

  if (selectedValidators.length > 0) {
    return selectedValidators;
  }

  const initialValidator = entry.initParams?.validator
    ? validatorOptions.find(
        (validator) =>
          validator.name?.toLowerCase() ===
            entry.initParams?.validator?.toLowerCase() ||
          validator.address === entry.initParams?.validator
      )
    : undefined;

  return initialValidator
    ? [initialValidator]
    : validatorOptions[0]
      ? [validatorOptions[0]]
      : [];
};
