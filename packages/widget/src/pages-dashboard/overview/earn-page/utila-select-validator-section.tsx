import { Maybe } from "purify-ts";
import { SelectValidator } from "../../../components/molecules/select-validator";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../domain/types/yields";
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
