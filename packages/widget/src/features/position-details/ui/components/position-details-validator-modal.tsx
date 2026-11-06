import { useTranslation } from "react-i18next";

import { SelectValidator } from "../../../yield-entry/views";
import { usePositionDetails } from "../../react/use-position-details";

/**
 * Rendered next to the whole position-details surface, not inside the exit
 * section: pending actions can require validator selection while the position
 * has nothing to exit.
 */
export const PositionDetailsValidatorModal = () => {
  const {
    integrationData: integrationDataValue,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
    validatorAddressesHandling,
    onValidatorsSubmit,
  } = usePositionDetails();

  const { t } = useTranslation();

  if (
    !integrationDataValue ||
    !validatorAddressesHandling.showValidatorsModal
  ) {
    return null;
  }

  return (
    <SelectValidator
      open
      onOpenChange={(open) => {
        if (!open) validatorAddressesHandling.closeModal();
      }}
      selectedValidators={validatorAddressesHandling.selectedValidatorKeys}
      onItemClick={(val) => {
        validatorAddressesHandling.onItemClick(val);

        if (validatorAddressesHandling.multiSelect) return;

        onValidatorsSubmit();
      }}
      selectedStake={integrationDataValue}
      validators={validatorsData}
      hasMore={hasMoreValidators}
      onLoadMore={onLoadMoreValidators}
      isLoadingMore={isLoadingMoreValidators}
      multiSelect={validatorAddressesHandling.multiSelect}
      {...(validatorAddressesHandling.multiSelect
        ? {
            confirm: {
              label: t("position_details.select_validators.submit"),
              onClick: () => onValidatorsSubmit(),
              disabled: validatorAddressesHandling.submitDisabled,
            },
          }
        : {})}
    />
  );
};
