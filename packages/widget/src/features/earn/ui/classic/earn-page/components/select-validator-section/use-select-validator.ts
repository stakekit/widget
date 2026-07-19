import type { EarnValidator } from "../../../../../../../domain/schema/earn-models";

import { useTrackEvent } from "../../../../../../tracking/react/use-track-event";
import { useEarnPageModel } from "../../state/earn-page-model";

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
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
  } = useEarnPageModel();

  const isLoading = appLoading || selectValidatorIsLoading;

  const trackEvent = useTrackEvent();

  const onViewMoreClick = () => trackEvent("selectValidatorViewMoreClicked");
  const onClose = () => trackEvent("selectValidatorModalClosed");
  const onOpen = () => trackEvent("selectValidatorModalOpened");

  const onItemClick = (item: EarnValidator) => {
    trackEvent("validatorSelected", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorSelect(item);
  };

  const onRemoveValidator = (item: EarnValidator) => {
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
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
  };
};
