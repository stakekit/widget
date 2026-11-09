import { type ReactNode, useState } from "react";

import type { EarnValidator } from "../../../../domain/earn/validator";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../domain/earn/yield-schema";
import { SelectValidator } from "../../../yield-entry/views";
import { useSelectValidator } from "../use-select-validator";

export type EarnValidatorTriggerState = {
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedValidators: EarnValidator[];
  readonly multiSelect: boolean;
  readonly onRemoveValidator: (item: EarnValidator) => void;
  /** Opens the validator list; focus returns to the opener on close. */
  readonly open: () => void;
};

/**
 * The validator selection of the Earn form, when the yield needs one: the
 * caller's trigger, which opens the validator list.
 */
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
  const [open, setOpen] = useState(false);

  if (!selectedStake || !isYieldValidatorSelectionRequired(selectedStake)) {
    return null;
  }

  const selectedValidatorsArr = [...selectedValidators.values()];
  const multiSelect = isYieldActionArgRequired(
    selectedStake,
    "enter",
    "validatorAddresses"
  );
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) onOpen();
    else onClose();
  };

  return (
    <>
      {renderTrigger({
        multiSelect,
        onRemoveValidator,
        open: () => onOpenChange(true),
        selectedStake,
        selectedValidators: selectedValidatorsArr,
      })}
      <SelectValidator
        open={open}
        onOpenChange={onOpenChange}
        selectedValidators={new Set(selectedValidatorsArr.map((v) => v.key))}
        multiSelect={multiSelect}
        selectedStake={selectedStake}
        onItemClick={onItemClick}
        onViewMoreClick={onViewMoreClick}
        search={{ value: validatorSearch, onValueChange: onValidatorSearch }}
        isLoading={isLoading}
        validators={validatorsData ?? []}
        hasMore={hasMoreValidators}
        isLoadingMore={isLoadingMoreValidators}
        onLoadMore={onLoadMoreValidators}
      />
    </>
  );
};
