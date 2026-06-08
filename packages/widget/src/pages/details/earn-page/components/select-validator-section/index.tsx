import { Maybe } from "purify-ts";
import { SelectValidator } from "../../../../../components/molecules/select-validator";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../../../domain/types/yields";
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
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
  } = useSelectValidator();

  const validators = validatorsData.orDefault([]);

  return Maybe.fromRecord({ selectedStake })
    .filter((val) => isYieldValidatorSelectionRequired(val.selectedStake))
    .map((val) => {
      const selectedValidatorsArr = [...selectedValidators.values()];

      const multiSelect = isYieldActionArgRequired(
        val.selectedStake,
        "enter",
        "validatorAddresses"
      );

      return (
        <SelectValidator
          trigger={
            <SelectValidatorTrigger
              onRemoveValidator={onRemoveValidator}
              selectedValidatorsArr={selectedValidatorsArr}
              multiSelect={multiSelect}
              selectedStake={val.selectedStake}
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
          isLoading={isLoading}
          validators={validators}
          hasMore={hasMoreValidators}
          isLoadingMore={isLoadingMoreValidators}
          onLoadMore={onLoadMoreValidators}
        />
      );
    })
    .extractNullable();
};
