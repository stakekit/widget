import { Box } from "../../../../../components";
import { ValidatorDto } from "@stakekit/api-hooks";
import { useDetailsContext } from "../../state/details-context";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { SelectValidatorTrigger } from "./select-validator-trigger";
import { SelectValidator } from "../../../../../components/molecules/select-validator";

export const SelectValidatorSection = () => {
  const {
    appLoading,
    tokenBalancesScanLoading,
    yieldOpportunityLoading,
    stakeTokenAvailableAmountLoading,
    multiYieldsLoading,
    onValidatorSelect,
    onValidatorRemove,
    selectedValidators,
    selectedStake,
    defaultTokensIsLoading,
  } = useDetailsContext();

  const isLoading =
    appLoading ||
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    stakeTokenAvailableAmountLoading;

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
    Maybe.fromRecord({ selectedStake })
      .filter((val) => !!val.selectedStake.validators.length)
      .map(({ selectedStake }) => {
        const selectedValidatorsArr = [...selectedValidators.values()];

        const multiSelect =
          !!selectedStake.args.enter.args?.validatorAddresses?.required;

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
            selectedStake={selectedStake}
            onItemClick={onItemClick}
            onViewMoreClick={onViewMoreClick}
            onClose={onClose}
            onOpen={onOpen}
          />
        );
      })
      .extractNullable()
  );
};
