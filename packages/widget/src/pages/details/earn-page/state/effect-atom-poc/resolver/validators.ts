import { Maybe } from "purify-ts";
import { getInitSelectedValidators } from "../../../../../../domain/types/stake";
import type { EarnEntryKey, EarnValidatorOption } from "../types";

export const resolveValidators = ({
  entry,
  selectedValidatorKeys,
  validatorOptions,
}: {
  entry: EarnEntryKey;
  selectedValidatorKeys: ReadonlySet<string>;
  validatorOptions: ReadonlyArray<EarnValidatorOption>;
}) => {
  if (validatorOptions.length === 0) {
    return [];
  }

  const selectedValidators = validatorOptions.filter((validator) =>
    selectedValidatorKeys.has(validator.address)
  );

  if (selectedValidators.length > 0) {
    return selectedValidators;
  }

  return [
    ...getInitSelectedValidators({
      initQueryParams: Maybe.fromNullable(entry.initParams),
      validators: [...validatorOptions],
    }).values(),
  ];
};
