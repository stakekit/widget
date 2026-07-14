import { Array as EArray, Option } from "effect";
import type { ComponentProps } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { ValidatorKey } from "../../../domain/types/validators";

import { vars } from "../../../styles/theme/contract.css";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { CheckSteps } from "../../atoms/icons/check-steps";
import { PreferredIcon } from "../../atoms/icons/preferred";
import { Image } from "../../atoms/image";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../atoms/select-modal";
import { textStyles } from "../../atoms/typography/styles.css";
import { Text } from "../../atoms/typography/text";
import { GroupedVirtualList } from "../../atoms/virtual-list";
import { useMetaInfo } from "./meta-info";
import {
  groupLabel,
  inactiveContainer,
  modalItemNameContainer,
  noWrap,
  rewardRateLabel,
  rewardRateText,
  validatorVirtuosoContainer,
} from "./styles.css";

export type GroupedItem = { items: EarnValidator[]; label: string };

export const SelectValidatorList = ({
  multiSelect,
  selectedValidators,
  onItemClick,
  onViewMoreClick,
  selectedStake,
  groupCounts,
  groupedItems,
  tableData,
}: {
  multiSelect: boolean;
  selectedValidators: Set<ValidatorKey>;
  onItemClick: (item: EarnValidator) => void;
  onViewMoreClick: () => void;
  selectedStake: EarnYieldWithProvider;
  tableData: EarnValidator[];
  groupedItems: GroupedItem[];
  groupCounts: number[];
}) => {
  const { t } = useTranslation();

  return (
    <GroupedVirtualList
      increaseViewportBy={{ bottom: 50, top: 0 }}
      estimateSize={() => 140}
      groupCounts={groupCounts}
      data-rk="select-validator-list"
      groupContent={(index) => {
        const group = EArray.get(groupedItems, index);

        if (
          Option.isNone(group) ||
          group.value.label === "view_more" ||
          !group.value.items.length
        ) {
          return null;
        }

        return (
          <Box py="3" px="4" background="modalBodyBackground">
            <Text
              className={groupLabel}
              variant={{ weight: "bold", type: "muted", size: "small" }}
            >
              {group.value.label}
            </Text>
          </Box>
        );
      }}
      className={validatorVirtuosoContainer}
      itemContent={(index, groupIndex) => {
        if (groupedItems[groupIndex]?.label === "view_more") {
          return (
            <Box display="flex" justifyContent="center" marginTop="6">
              <Button
                variant={{ color: "secondary", size: "small" }}
                onClick={onViewMoreClick}
              >
                <Text>{t("details.validators_view_all")}</Text>
              </Button>
            </Box>
          );
        }

        const itemOption = EArray.get(tableData, index);

        if (Option.isNone(itemOption)) return null;

        const item = itemOption.value;

        const isPreferred = item.preferred;

        const status = item.status;

        const itemSelected = selectedValidators.has(item.key);

        const _onItemClick: ComponentProps<
          typeof SelectModalItem
        >["onItemClick"] = ({ closeModal }) => {
          onItemClick(item);
          !multiSelect && closeModal();
        };

        const rateTypeLabel = getRewardTypeFormatted(item.rewardRate?.rateType);

        return (
          <SelectModalItemContainer>
            <SelectModalItem
              onItemClick={_onItemClick}
              testId={item.key}
              selected={!multiSelect && itemSelected}
            >
              <Box flex={1} display="flex" flexDirection="column" gap="3">
                <Box display="flex" justifyContent="center" alignItems="center">
                  {multiSelect && (
                    <Box
                      background={
                        itemSelected
                          ? "selectValidatorMultiSelectedBackground"
                          : "selectValidatorMultiDefaultBackground"
                      }
                      hw="8"
                      as="button"
                      borderRadius="full"
                      marginRight="2"
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                    >
                      {itemSelected ? (
                        <CheckSteps hw={16} color={vars.color.white} />
                      ) : null}
                    </Box>
                  )}

                  <Image
                    wrapperProps={{ hw: "9" }}
                    imgProps={{ borderRadius: "full" }}
                    src={item.logoURI}
                    fallbackName={item.name || item.address}
                  />

                  <Box
                    display="flex"
                    flexDirection="column"
                    flex={1}
                    marginLeft="2"
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box className={modalItemNameContainer}>
                        <Text variant={{ weight: "bold" }}>
                          {item.name ?? item.address}
                        </Text>

                        {isPreferred && (
                          <Box marginLeft="1" display="flex">
                            <PreferredIcon />
                          </Box>
                        )}

                        {status !== "active" && (
                          <Box marginLeft="1" className={inactiveContainer}>
                            <Text
                              variant={{
                                type: "white",
                                weight: "medium",
                                size: "small",
                              }}
                              className={noWrap}
                            >
                              {t(
                                status === "jailed"
                                  ? "details.validators_jailed"
                                  : "details.validators_inactive"
                              )}
                            </Text>
                          </Box>
                        )}
                      </Box>

                      <Box textAlign="end" flexShrink={0} marginLeft="2">
                        <Text
                          className={rewardRateText}
                          variant={{ weight: "bold" }}
                        >
                          {getRewardRateFormatted({
                            rewardRate: item.rewardRate?.total,
                          })}
                        </Text>

                        {rateTypeLabel ? (
                          <Text
                            className={rewardRateLabel}
                            variant={{
                              type: "muted",
                              weight: "normal",
                              size: "small",
                            }}
                          >
                            {rateTypeLabel}
                          </Text>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                </Box>

                <ValidatorMeta
                  address={item.address}
                  commission={item.commission}
                  stakedBalance={item.tvl}
                  votingPower={item.votingPower}
                  nominatorCount={item.nominatorCount}
                  subnetName={item.subnet?.name}
                  marketCap={item.subnet?.tvl}
                  tokenSymbol={item.subnet?.tokenSymbol}
                  rewardRate={undefined}
                  rewardType={undefined}
                  stakedBalanceToken={selectedStake.token}
                  website={undefined}
                />
              </Box>
            </SelectModalItem>
          </SelectModalItemContainer>
        );
      }}
    />
  );
};

const ValidatorMeta = memo((props: Parameters<typeof useMetaInfo>[0]) => {
  const metaInfo = useMetaInfo(props);

  return (
    <Box display="flex" flexDirection="column" gap="1">
      {Object.entries(metaInfo)
        .filter(
          (val): val is [keyof typeof metaInfo, NonNullable<(typeof val)[1]>] =>
            !!val[1]
        )
        .map(([key, val]) => {
          return (
            <Box
              key={key}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text variant={{ type: "muted" }}>{val.title}</Text>

              <Box className={textStyles({ type: "muted", weight: "normal" })}>
                {val.val}
              </Box>
            </Box>
          );
        })}
    </Box>
  );
});
