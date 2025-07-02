import { GroupedVirtualList } from "@sk-widget/components/atoms/virtual-list";
import type { ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import type { ComponentProps } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { vars } from "../../../styles";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { CheckSteps } from "../../atoms/icons/check-steps";
import { PreferredIcon } from "../../atoms/icons/preferred";
import { Image } from "../../atoms/image";
import { ImageFallback } from "../../atoms/image-fallback";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../atoms/select-modal";
import { Text } from "../../atoms/typography";
import { useMetaInfo } from "./meta-info";
import {
  inactiveContainer,
  modalItemNameContainer,
  noWrap,
  validatorVirtuosoContainer,
} from "./styles.css";

export type GroupedItem = { items: ValidatorDto[]; label: string };

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
  selectedValidators: Set<ValidatorDto["address"]>;
  onItemClick: (item: ValidatorDto) => void;
  onViewMoreClick: () => void;
  selectedStake: YieldDto;
  tableData: ValidatorDto[];
  groupedItems: GroupedItem[];
  groupCounts: number[];
}) => {
  const { t } = useTranslation();

  return (
    <GroupedVirtualList
      increaseViewportBy={{ bottom: 50, top: 0 }}
      estimateSize={() => 60}
      groupCounts={groupCounts}
      groupContent={(index) => {
        if (
          groupedItems[index].label === "view_more" ||
          !groupedItems[index].items.length
        ) {
          return null;
        }

        return (
          <Box
            py="4"
            px="4"
            background="modalBodyBackground"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Text variant={{ weight: "medium" }}>
              {groupedItems[index].label}
            </Text>

            <Box marginRight="4">
              <Text variant={{ weight: "normal", type: "muted" }}>
                {getRewardTypeFormatted(selectedStake.rewardType)}
              </Text>
            </Box>
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

        const item = tableData[index];

        const isPreferred = item.preferred;

        const status = item.status;

        const itemSelected = selectedValidators.has(item.address);

        const _onItemClick: ComponentProps<
          typeof SelectModalItem
        >["onItemClick"] = ({ closeModal }) => {
          onItemClick(item);
          !multiSelect && closeModal();
        };

        return (
          <SelectModalItemContainer>
            <SelectModalItem onItemClick={_onItemClick} testId={item.address}>
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
                      {selectedValidators.has(item.address) ? (
                        <CheckSteps hw={16} color={vars.color.white} />
                      ) : null}
                    </Box>
                  )}

                  <Image
                    containerProps={{ hw: "9" }}
                    imageProps={{ borderRadius: "full" }}
                    src={item.image}
                    fallback={
                      <ImageFallback
                        name={item.name || item.address}
                        tokenLogoHw="9"
                        textVariant={{ type: "white", weight: "bold" }}
                      />
                    }
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

                      <Box>
                        <Text variant={{ size: "large" }}>
                          {getRewardRateFormatted({
                            rewardRate: item.apr,
                            rewardType: selectedStake.rewardType,
                          })}
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                <ValidatorMeta
                  address={item.address}
                  commission={item.commission}
                  stakedBalance={item.stakedBalance}
                  votingPower={item.votingPower}
                  nominatorCount={item.nominatorCount}
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

              <Text variant={{ type: "muted", weight: "normal" }}>
                {val.val}
              </Text>
            </Box>
          );
        })}
    </Box>
  );
});
