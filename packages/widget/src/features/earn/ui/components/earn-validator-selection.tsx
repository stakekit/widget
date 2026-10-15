import type { ReactNode } from "react";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../../domain/earn/yield";
import { SelectValidator } from "../../../yield-entry/views";
import { useSelectValidator } from "../../react/use-select-validator";

export type EarnValidatorTriggerState = {
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedValidators: EarnValidator[];
  readonly multiSelect: boolean;
  readonly onRemoveValidator: (item: EarnValidator) => void;
};

export const EarnValidatorSelection = ({
  renderTrigger,
}: {
  readonly renderTrigger: (selection: EarnValidatorTriggerState) => ReactNode;
}) => {
  const {
    hasMoreValidators,
    isLoading,
    isLoadingMoreValidators,
    onClose,
    onItemClick,
    onLoadMoreValidators,
    onOpen,
    onRemoveValidator,
    onValidatorSearch,
    onViewMoreClick,
    selectedStake,
    selectedValidators,
    validatorSearch,
    validatorsData,
  } = useSelectValidator();

  if (!selectedStake || !isYieldValidatorSelectionRequired(selectedStake)) {
    return null;
  }

  const selectedValidatorsArr = [...selectedValidators.values()];
  const multiSelect = isYieldActionArgRequired(
    selectedStake,
    "enter",
    "validatorAddresses"
  );

  return (
    <SelectValidator
      trigger={renderTrigger({
        multiSelect,
        onRemoveValidator,
        selectedStake,
        selectedValidators: selectedValidatorsArr,
      })}
      selectedValidators={new Set(selectedValidatorsArr.map((v) => v.key))}
      multiSelect={multiSelect}
      selectedStake={selectedStake}
      onItemClick={onItemClick}
      onViewMoreClick={onViewMoreClick}
      onClose={onClose}
      onOpen={onOpen}
      onSearch={onValidatorSearch}
      searchValue={validatorSearch}
      isLoading={isLoading}
      validators={validatorsData ?? []}
      hasMore={hasMoreValidators}
      isLoadingMore={isLoadingMoreValidators}
      onLoadMore={onLoadMoreValidators}
    />
  );
};
