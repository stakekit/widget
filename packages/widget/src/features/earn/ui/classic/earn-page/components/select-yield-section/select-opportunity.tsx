import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { Array as EArray, Option } from "effect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import { getYieldOutputToken } from "../../../../../../../domain/types/yields";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { GroupedVirtualList } from "../../../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/react/use-track-event";
import {
  SelectModal,
  SelectModalItemContainer,
} from "../../../../../../widget-shell/ui/select-modal";
import { selectModalGroupLabel } from "../../../../../../widget-shell/ui/select-modal/styles.css";
import { ProviderIcon } from "../../../../../../widget-shell/ui/token-icon/provider-icon";
import { SelectOpportunityListItem } from "../../../../components/select-opportunity-list-item";
import { useEarnPageModel } from "../../state/earn-page-model";
import { selectOpportunityButton } from "./styles.css";

export const SelectOpportunity = () => {
  const {
    selectedStake,
    selectedStakeData,
    onSelectOpportunityClose,
    onYieldSearch,
    stakeSearch,
    onYieldSelect,
  } = useEarnPageModel();

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const data = useMemo(
    () =>
      selectedStake
        ? (() => {
            const val = [...selectedStakeData.groupsWithCounts.values()];

            return {
              ss: selectedStake,
              all: selectedStakeData.filtered,
              groups: val.map((v) => v.title),
              groupCounts: val.map((v) => v.itemsLength),
            };
          })()
        : null,
    [selectedStake, selectedStakeData]
  );

  const variant = useWidgetConfig("variant");

  if (!data) return null;

  const displayToken = getYieldOutputToken(data.ss) ?? data.ss.token;

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
            className={clsx(
              combineRecipeWithVariant({
                rec: selectOpportunityButton,
                variant,
              }),
              pressAnimation
            )}
            data-testid="select-opportunity"
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <ProviderIcon
                token={displayToken}
                metadata={{
                  logoURI: data.ss.metadata.logoURI,
                  name: data.ss.metadata.name,
                  provider: data.ss.provider,
                }}
              />
              <Text variant={{ weight: "bold" }}>{displayToken.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <GroupedVirtualList
        estimateSize={() => 60}
        groupCounts={data.groupCounts}
        groupContent={(index) => {
          return (
            <Box py="3" px="4" background="modalBodyBackground">
              <Text
                className={selectModalGroupLabel}
                variant={{ type: "muted", weight: "bold", size: "small" }}
              >
                {data.groups[index]}
              </Text>
            </Box>
          );
        }}
        itemContent={(index) => {
          const itemOption = EArray.get(data.all, index);

          if (Option.isNone(itemOption)) return null;

          const item = itemOption.value;

          return (
            <SelectModalItemContainer>
              {typeof item === "string" ? (
                <Box py="3">
                  <Text
                    className={selectModalGroupLabel}
                    variant={{ type: "muted", weight: "bold", size: "small" }}
                  >
                    {item}
                  </Text>
                </Box>
              ) : (
                <SelectOpportunityListItem
                  item={item}
                  selected={item.id === data.ss.id}
                  onYieldSelect={(yieldDto) => onYieldSelect(yieldDto.id)}
                  testId={`select-opportunity__item_${item.id}-${index}`}
                />
              )}
            </SelectModalItemContainer>
          );
        }}
      />
    </SelectModal>
  );
};
