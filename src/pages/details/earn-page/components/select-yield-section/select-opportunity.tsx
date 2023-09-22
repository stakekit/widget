import { List, Maybe } from "purify-ts";
import { GroupedVirtuoso } from "react-virtuoso";
import { SelectedStakeData } from "../../types";
import {
  Box,
  CaretDownIcon,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  SelectModalProps,
  Text,
} from "../../../../../components";
import { useTranslation } from "react-i18next";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { apyToPercentage } from "../../../../../utils";
import { useMemo } from "react";
import { ExtraData } from "../../../../../state/stake/types";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { hideScrollbar, selectItemText } from "../../styles.css";

export const SelectOpportunity = ({
  selectedStake,
  selectedStakeData,
  onSearch,
  onItemSelect,
  onSelectOpportunityClose,
}: {
  selectedStake: ExtraData["selectedStake"];
  selectedStakeData: Maybe<SelectedStakeData>;
  onSearch: SelectModalProps["onSearch"];
  onItemSelect: (yieldId: string) => void;
  onSelectOpportunityClose: () => void;
}) => {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      selectedStakeData
        .chain((ssd) =>
          selectedStake.map((ss) => {
            const val = [...ssd.groupsWithCounts.values()];

            return {
              ss,
              all: ssd.all,
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
      onSearch={onSearch}
      onClose={onSelectOpportunityClose}
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
      <GroupedVirtuoso
        increaseViewportBy={{ bottom: 50, top: 0 }}
        groupCounts={data.groupCounts}
        className={hideScrollbar}
        groupContent={(index) => {
          return (
            <Box py="4" px="4" background="background">
              <Text variant={{ weight: "bold", size: "small" }}>
                {data.groups[index]}
              </Text>
            </Box>
          );
        }}
        itemContent={(index) => {
          const item = data.all[index];

          return (
            <SelectModalItemContainer>
              {typeof item === "string" ? (
                <Box py="4">
                  <Text variant={{ weight: "bold", size: "small" }}>
                    {item}
                  </Text>
                </Box>
              ) : (
                <SelectModalItem
                  testId={`select-opportunity__item_${item.id}-${index}`}
                  onItemClick={() => onItemSelect(item.id)}
                >
                  <TokenIcon
                    metadata={item.metadata}
                    token={Maybe.fromNullable(item.metadata.rewardTokens)
                      .chain((rt) => List.head(rt))
                      .orDefault(item.token)}
                  />

                  <Box
                    display="flex"
                    flexDirection="column"
                    flex={1}
                    marginLeft="2"
                    minWidth="0"
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
                        <Text
                          className={selectItemText}
                          variant={{
                            size: "small",
                            weight: "bold",
                          }}
                        >
                          {item.metadata.name}
                        </Text>
                      </Box>

                      <Box>
                        <Text variant={{ size: "small" }}>
                          {apyToPercentage(item.apy)}%
                        </Text>
                      </Box>
                    </Box>

                    <Box display="flex" marginTop="1" flexWrap="wrap" gap="1">
                      <Text
                        variant={{
                          size: "small",
                          type: "muted",
                        }}
                      >
                        {Maybe.fromNullable(item.metadata.rewardTokens)
                          .map((rt) => rt.map((t) => t.symbol).join(", "))
                          .orDefault(item.token.symbol)}
                      </Text>

                      {Maybe.fromNullable(item.metadata.rewardTokens)
                        .map(() => (
                          <Box
                            background="background"
                            borderRadius="2xl"
                            px="2"
                          >
                            <Text
                              variant={{
                                size: "small",
                                type: "muted",
                              }}
                            >
                              {item.token.symbol}
                            </Text>
                          </Box>
                        ))
                        .extractNullable()}
                    </Box>
                  </Box>
                </SelectModalItem>
              )}
            </SelectModalItemContainer>
          );
        }}
      />
    </SelectModal>
  );
};
