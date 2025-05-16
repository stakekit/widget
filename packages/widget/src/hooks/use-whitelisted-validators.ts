import { useSettings } from "@sk-widget/providers/settings";
import { useMemo } from "react";

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
