import { SelectModal, SelectModalItemContainer } from "@sk-widget/components";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { SelectOpportunityListItem } from "@sk-widget/pages/details/earn-page/components/new-select-yield-section/select-yield";
import { SelectYieldTrigger } from "@sk-widget/pages/details/earn-page/components/new-select-yield-section/select-yield-trigger";
import { useEarnPageContext } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const NewSelectYieldSection = () => {
  const {
    appLoading,
    yieldsToSelect,
    selectedStake,
    selectYieldIsLoading,
    onYieldSearch,
    stakeSearch,
    onSelectOpportunityClose,
  } = useEarnPageContext();

  const { t } = useTranslation();

  const isLoading = appLoading || selectYieldIsLoading;

  const data = useMemo(
    () =>
      Maybe.fromRecord({
        selectedStake,
        yieldsToSelect,
      }).extractNullable(),
    [yieldsToSelect, selectedStake]
  );

  if (!data || isLoading) return null;

  return (
    <SelectModal
      title={t("details.opportunity_search_title")}
      onSearch={onYieldSearch}
      searchValue={stakeSearch}
      onClose={onSelectOpportunityClose}
      trigger={<SelectYieldTrigger selectedYield={data.selectedStake} />}
    >
      <VirtualList
        data={data.yieldsToSelect}
        estimateSize={() => 60}
        itemContent={(index, item) => (
          <SelectModalItemContainer>
            <SelectOpportunityListItem index={index} item={item} />
          </SelectModalItemContainer>
        )}
      />
    </SelectModal>
  );
};
