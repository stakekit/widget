import { EarnValidatorSelection } from "../../../../components/earn-validator-selection";
import { SelectValidatorTrigger } from "./select-validator-trigger";

export const SelectValidatorSection = () => (
  <EarnValidatorSelection
    renderTrigger={({
      multiSelect,
      onRemoveValidator,
      selectedStake,
      selectedValidators,
    }) => (
      <SelectValidatorTrigger
        onRemoveValidator={onRemoveValidator}
        selectedValidatorsArr={selectedValidators}
        multiSelect={multiSelect}
        selectedStake={selectedStake}
      />
    )}
  />
);
