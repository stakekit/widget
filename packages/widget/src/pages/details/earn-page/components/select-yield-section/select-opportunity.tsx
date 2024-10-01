import { Trigger } from "@radix-ui/react-dialog";
import { ProviderIcon } from "@sk-widget/components/atoms/token-icon/provider-icon";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { getYieldTypeLabelsMap } from "@sk-widget/domain/types";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  CaretDownIcon,
  SelectModal,
  SelectModalItemContainer,
  Text,
} from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useEarnPageContext } from "../../state/earn-page-context";
import { SelectYieldType } from "./select-opportunity-list-item";

export const SelectOpportunity = () => {
  const {
    selectedStake,
    selectedYieldType,
    yieldTypesData,
    onSelectOpportunityClose,
    onYieldSearch,
    stakeSearch,
  } = useEarnPageContext();

  const trackEvent = useTrackEvent();
  const { t } = useTranslation();

  const yieldTypeLabel = useMemo(
    () => selectedYieldType.map((val) => getYieldTypeLabelsMap(t)[val].title),
    [selectedYieldType, t]
  );

  const data = useMemo(
    () =>
      Maybe.fromRecord({
        selectedStake,
        yieldTypesData,
        selectedYieldType,
        yieldTypeLabel,
      }).extractNullable(),
    [selectedYieldType, yieldTypesData, yieldTypeLabel, selectedStake]
  );

  if (!data) return null;

  return (
    <SelectModal
      title={t("details.opportunity_search_title")}
      onSearch={onYieldSearch}
      searchValue={stakeSearch}
      onClose={onSelectOpportunityClose}
      onOpen={() => trackEvent("selectYieldModalOpened")}
      trigger={
        <Trigger asChild>
          <Box
            as="button"
            display="flex"
            justifyContent="center"
            alignItems="center"
            background="background"
            borderRadius="2xl"
            px="2"
            py="1"
            data-testid="select-opportunity"
            className={pressAnimation}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <ProviderIcon
                token={data.selectedStake.token}
                metadata={data.selectedStake.metadata}
              />
              <Text variant={{ weight: "bold" }}>{data.yieldTypeLabel}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <VirtualList
        data={data.yieldTypesData}
        estimateSize={() => 60}
        itemContent={(_, item) => (
          <SelectModalItemContainer>
            <SelectYieldType item={item} />
          </SelectModalItemContainer>
        )}
      />
    </SelectModal>
  );
};
