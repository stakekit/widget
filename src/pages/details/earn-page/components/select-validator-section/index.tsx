import { Box } from "../../../../../components";
import type { ValidatorDto } from "@stakekit/api-hooks";
import { useDetailsContext } from "../../state/details-context";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { SelectValidatorTrigger } from "./select-validator-trigger";
import { SelectValidator } from "../../../../../components/molecules/select-validator";

export const SelectValidatorSection = () => {
  const {
    appLoading,
    onValidatorSelect,
    onValidatorRemove,
    selectedValidators,
    selectedStake,
    selectValidatorIsLoading,
    onValidatorSearch,
    validatorsData,
    validatorSearch,
  } = useDetailsContext();

  const isLoading = appLoading || selectValidatorIsLoading;

  const trackEvent = useTrackEvent();

  const onViewMoreClick = () => trackEvent("selectValidatorViewMoreClicked");
  const onClose = () => trackEvent("selectValidatorModalClosed");
  const onOpen = () => trackEvent("selectValidatorModalOpened");

  const onItemClick = (item: ValidatorDto) => {
    trackEvent("validatorSelected", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorSelect(item);
  };

  const onRemoveValidator = (item: ValidatorDto) => {
    trackEvent("validatorRemoved", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorRemove(item);
  };

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
