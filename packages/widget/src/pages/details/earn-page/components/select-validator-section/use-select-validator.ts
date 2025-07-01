import type { ValidatorDto } from "@stakekit/api-hooks";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useEarnPageContext } from "../../state/earn-page-context";

export const useSelectValidator = () => {
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
  } = useEarnPageContext();

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

  return {
    isLoading,
    onViewMoreClick,
    onClose,
    onOpen,
    onItemClick,
    onRemoveValidator,
    selectedValidators,
    selectedStake,
    onValidatorSearch,
    validatorsData,
    validatorSearch,
  };
};
