import { Maybe } from "purify-ts";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { SelectValidator } from "../../../components/molecules/select-validator";
import { useSelectValidator } from "../../../pages/details/earn-page/components/select-validator-section/use-select-validator";
import { SelectValidatorTrigger } from "./utila-select-validator-trigger";

export const UtilaSelectValidatorSection = () => {
  const {
    isLoading,
    onViewMoreClick,
    onClose,
    onOpen,
    onItemClick,
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
                selectedValidatorsArr={selectedValidatorsArr}
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
