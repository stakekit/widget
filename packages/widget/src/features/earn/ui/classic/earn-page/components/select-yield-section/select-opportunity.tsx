import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { Array as EArray, Option } from "effect";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import {
  getYieldOutputToken,
  getYieldTypeLabels,
} from "../../../../../../../domain/earn/yield";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import {
  SelectModal,
  SelectModalItemContainer,
} from "../../../../../../../shared/ui/components/select-modal";
import { selectModalGroupLabel } from "../../../../../../../shared/ui/components/select-modal/styles.css";
import { ProviderIcon } from "../../../../../../../shared/ui/components/token-icon/provider-icon";
import { GroupedVirtualList } from "../../../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/state";
import { useEarnYieldSelection } from "../../../../../react/use-earn-facades";
import { SelectOpportunityListItem } from "../../../../components/select-opportunity-list-item";
import { selectOpportunityButton } from "./styles.css";

export const SelectOpportunity = () => {
  const { select, setSearch, view } = useEarnYieldSelection();

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const data = view.selected
    ? {
        ss: view.selected,
        all: view.filtered,
        groups: view.groups.map((group) => {
          const example = view.filtered.find(
            (item) => getYieldTypeLabels(item, t).type === group.type
          );
          return example ? getYieldTypeLabels(example, t).title : group.type;
        }),
        groupCounts: view.groups.map((group) => group.itemsLength),
      }
    : null;

  const variant = useWidgetConfig("variant");

  if (!data) return null;

  const displayToken = getYieldOutputToken(data.ss) ?? data.ss.token;

  return (
    <SelectModal
      title={t("details.opportunity_search_title")}
      onSearch={setSearch}
      searchValue={view.search}
      onClose={() => setSearch("")}
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
                  onYieldSelect={(yieldDto) => select(yieldDto.id)}
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
