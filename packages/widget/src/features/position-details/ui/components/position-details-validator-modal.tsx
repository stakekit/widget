import { useTranslation } from "react-i18next";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { SelectValidator } from "../../../yield-entry/views";
import { usePositionDetails } from "../../react/use-position-details";

/**
 * Rendered next to the whole position-details surface, not inside the unstake
 * section: pending actions can require validator selection while the position
 * has nothing to unstake.
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
      selectedValidators={validatorAddressesHandling.selectedValidatorKeys}
      onItemClick={(val) => {
        validatorAddressesHandling.onItemClick(val);

        if (validatorAddressesHandling.multiSelect) return;

        onValidatorsSubmit();
      }}
      selectedStake={integrationDataValue}
      validators={validatorsData}
      hasMore={hasMoreValidators}
      isLoadingMore={isLoadingMoreValidators}
      onLoadMore={onLoadMoreValidators}
      multiSelect={validatorAddressesHandling.multiSelect}
      state={validatorAddressesHandling.modalState}
    >
      {validatorAddressesHandling.multiSelect && (
        <Box px="4" display="flex" alignItems="center" justifyContent="center">
          <Button
            variant={{
              color: validatorAddressesHandling.submitDisabled
                ? "disabled"
                : "primary",
            }}
            disabled={validatorAddressesHandling.submitDisabled}
            onClick={() => onValidatorsSubmit()}
          >
            {t("position_details.select_validators.submit")}
          </Button>
        </Box>
      )}
    </SelectValidator>
  );
};
