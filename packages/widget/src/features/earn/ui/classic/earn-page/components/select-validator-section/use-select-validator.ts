import type { EarnValidator } from "../../../../../../../domain/earn/models";
import { useEarnValidatorSelection } from "../../../../../react/use-earn-facades";

export const useSelectValidator = () => {
  const { loadMore, recordModalEvent, remove, select, setSearch, view } =
    useEarnValidatorSelection();

  const onViewMoreClick = () => recordModalEvent({ _tag: "ViewMoreClicked" });
  const onClose = () => recordModalEvent({ _tag: "Closed" });
  const onOpen = () => recordModalEvent({ _tag: "Opened" });

  const onItemClick = (item: EarnValidator) => select(item.key);

  const onRemoveValidator = (item: EarnValidator) => remove(item.key);

  return {
    isLoading: view.isLoading,
    onViewMoreClick,
    onClose,
    onOpen,
    onItemClick,
    onRemoveValidator,
    selectedValidators: view.selected,
    selectedStake: view.selectedYield,
    onValidatorSearch: setSearch,
    validatorsData: view.data,
    validatorSearch: view.search,
    hasMoreValidators: view.hasMore,
    isLoadingMoreValidators: view.isLoadingMore,
    onLoadMoreValidators: () => loadMore(undefined),
  };
};
