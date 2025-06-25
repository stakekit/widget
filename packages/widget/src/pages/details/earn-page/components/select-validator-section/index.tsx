import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { SelectValidator } from "@sk-widget/components/molecules/select-validator";
import { isEigenRestaking } from "@sk-widget/domain/types/yields";
import { Maybe } from "purify-ts";
import { SelectValidatorTrigger } from "./select-validator-trigger";
import { useSelectValidator } from "./use-select-validator";

export const SelectValidatorSection = () => {
  const {
    isLoading,
    onViewMoreClick,
    onClose,
    onOpen,
    onItemClick,
    onRemoveValidator,
    selectedValidators,
    selectedStake,
    validatorsData,
    validatorSearch,
    onValidatorSearch,
  } = useSelectValidator();

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    Maybe.fromRecord({ selectedStake, validatorsData })
      .filter((val) => !!val.selectedStake.validators.length)
      .map((val) => {
        const selectedValidatorsArr = [...selectedValidators.values()];

        const multiSelect =
          !!val.selectedStake.args.enter.args?.validatorAddresses?.required;

        return (
          <SelectValidator
            trigger={
              <SelectValidatorTrigger
                onRemoveValidator={onRemoveValidator}
                selectedValidatorsArr={selectedValidatorsArr}
                multiSelect={multiSelect}
                isEigenRestaking={isEigenRestaking(val.selectedStake)}
              />
            }
            selectedValidators={
              new Set(selectedValidatorsArr.map((v) => v.address))
            }
            multiSelect={multiSelect}
            selectedStake={val.selectedStake}
            onItemClick={onItemClick}
            onViewMoreClick={onViewMoreClick}
            onClose={onClose}
            onOpen={onOpen}
            onSearch={onValidatorSearch}
            searchValue={validatorSearch}
            validators={val.validatorsData}
          />
        );
      })
      .extractNullable()
  );
};
