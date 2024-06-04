import { Trigger } from "@radix-ui/react-alert-dialog";
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
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { GroupedVirtualList } from "../../../../../components/atoms/virtual-list";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { useEarnPageContext } from "../../state/earn-page-context";
import { SelectOpportunityListItem } from "./select-opportunity-list-item";

export const SelectOpportunity = () => {
  const {
    selectedStake,
    selectedStakeData,
    onSelectOpportunityClose,
    onYieldSearch,
    stakeSearch,
  } = useEarnPageContext();

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const data = useMemo(
    () =>
      selectedStakeData
        .chain((ssd) =>
          selectedStake.map((ss) => {
            const val = [...ssd.groupsWithCounts.values()];

            return {
              ss,
              all: ssd.filtered,
              groups: val.map((v) => v.title),
              groupCounts: val.map((v) => v.itemsLength),
            };
          })
        )
        .extractNullable(),
    [selectedStake, selectedStakeData]
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
              <TokenIcon token={data.ss.token} metadata={data.ss.metadata} />
              <Text variant={{ weight: "bold" }}>{data.ss.token.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <GroupedVirtualList
        groupCounts={data.groupCounts}
        groupContent={(index) => {
          return (
            <Box py="4" px="4" background="modalBodyBackground">
              <Text variant={{ weight: "bold" }}>{data.groups[index]}</Text>
            </Box>
          );
        }}
        itemContent={(index) => {
          const item = data.all[index];

          return (
            <SelectModalItemContainer>
              {typeof item === "string" ? (
                <Box py="4">
                  <Text variant={{ weight: "bold" }}>{item}</Text>
                </Box>
              ) : (
                <SelectOpportunityListItem index={index} item={item} />
              )}
            </SelectModalItemContainer>
          );
        }}
      />
    </SelectModal>
  );
};
