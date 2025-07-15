import { useMemo } from "react";
import { useSettings } from "../providers/settings";

export const useWhitelistedValidators = () => {
  const { whitelistedValidatorAddresses } = useSettings();

  return useMemo(
    () =>
      whitelistedValidatorAddresses
        ? new Set(whitelistedValidatorAddresses)
        : null,
    [whitelistedValidatorAddresses]
  );
};
