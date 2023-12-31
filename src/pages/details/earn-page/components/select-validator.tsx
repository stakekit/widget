import {
  Box,
  Button,
  CaretDownIcon,
  Divider,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  Text,
} from "../../../../components";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { Image } from "../../../../components/atoms/image";
import { useTranslation } from "react-i18next";
import { ValidatorDto } from "@stakekit/api-hooks";
import { ImageFallback } from "../../../../components/atoms/image-fallback";
import { useMemo, useState } from "react";
import { PreferredIcon } from "../../../../components/atoms/icons/preferred";
import {
  breakWord,
  modalItemNameContainer,
  triggerStyles,
  validatorVirtuosoContainer,
} from "../styles.css";
import { useDetailsContext } from "../state/details-context";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";
import { GroupedVirtualList } from "../../../../components/atoms/virtual-list";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { getRewardRateFormatted } from "../../../../utils/get-reward-rate";
import { getRewardTypeFormatted } from "../../../../utils/get-reward-type";

export const SelectValidator = () => {
  const { t } = useTranslation();

  const {
    appLoading,
    tokenBalancesScanLoading,
    yieldOpportunityLoading,
    stakeTokenAvailableAmountLoading,
    multiYieldsLoading,
    onValidatorSelect,
    selectedValidator,
    selectedStake,
    defaultTokensIsLoading,
  } = useDetailsContext();

  const isLoading =
    appLoading ||
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    stakeTokenAvailableAmountLoading;

  const [viewMore, setViewMore] = useState(false);

  const data = useMemo(
    () =>
      selectedStake.map((ss) => {
        if (!ss.validators.length) {
          return {
            tableData: [],
            groupedItems: [],
            groupCounts: [],
          };
        }

        const groupedItems = ss.validators.reduce(
          (acc, val) => {
            if (val.preferred) {
              acc[0].items.push(val);
            } else if (viewMore) {
              acc[1].items.push(val);
            }

            return acc;
          },
          [
            {
              items: [] as ValidatorDto[],
              label: t("details.validators_preferred"),
            },
            {
              items: [] as ValidatorDto[],
              label: t("details.validators_other"),
            },
          ]
        );

        // If we do not have preferred validators, show all other
        if (!groupedItems[0].items.length && ss.validators.length) {
          return {
            canViewMore: false,
            tableData: ss.validators,
            groupCounts: [ss.validators.length],
            groupedItems: [
              { items: ss.validators, label: t("details.validators_other") },
            ],
          };
        }

        const canViewMore =
          !viewMore && groupedItems[0].items.length !== ss.validators.length;

        return {
          tableData: groupedItems.flatMap((val) => val.items),
          groupedItems: [
            ...groupedItems.filter((val) => val.items.length),
            ...(canViewMore ? [{ items: [], label: "view_more" }] : []),
          ],
          groupCounts: [
            ...groupedItems
              .filter((val) => val.items.length)
              .map((val) => val.items.length),
            ...(canViewMore ? [1] : []),
          ],
          canViewMore,
        };
      }),
    [selectedStake, t, viewMore]
  );

  const trackEvent = useTrackEvent();

  const onViewMoreClick = () => {
    trackEvent("selectValidatorViewMoreClicked");
    setViewMore(true);
  };

  const onItemClick = (item: ValidatorDto) => {
    trackEvent("validatorSelected", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorSelect(item);
  };

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    Maybe.fromRecord({ selectedStake, selectedValidator })
      .map(({ selectedStake, selectedValidator }) => {
        return (
          <SelectModal
            title={t("details.validator_search_title")}
            onClose={() => setViewMore(false)}
            onOpen={() => trackEvent("selectValidatorModalOpened")}
            trigger={
              <Trigger
                disabled={!selectedStake.validators.length}
                className={triggerStyles}
              >
                <Box display="flex">
                  <Box flex={1}>
                    <Box
                      marginRight="2"
                      display="flex"
                      justifyContent="flex-start"
                      alignItems="center"
                      marginTop="3"
                    >
                      <Box marginRight="2">
                        <Image
                          containerProps={{ hw: "5" }}
                          imageProps={{ borderRadius: "full" }}
                          src={selectedValidator.image}
                          fallback={
                            <Box marginRight="1">
                              <ImageFallback
                                name={
                                  selectedValidator.name ||
                                  selectedValidator.address
                                }
                                tokenLogoHw="5"
                                textVariant={{
                                  type: "white",
                                  weight: "bold",
                                }}
                              />
                            </Box>
                          }
                        />
                      </Box>
                      <Text className={breakWord} variant={{ weight: "bold" }}>
                        {t("details.staked_via", {
                          validator:
                            selectedValidator.name ?? selectedValidator.address,
                        })}
                      </Text>

                      {selectedValidator.preferred && (
                        <Box marginLeft="1" display="flex">
                          <PreferredIcon />
                        </Box>
                      )}
                      {!!selectedStake.validators.length && (
                        <Box marginLeft="2">
                          <CaretDownIcon />
                        </Box>
                      )}
                    </Box>
                    <Box marginTop="4">
                      <Divider />
                    </Box>
                  </Box>
                </Box>
              </Trigger>
            }
          >
            {data
              .map((val) => (
                <GroupedVirtualList
                  data={val.tableData}
                  increaseViewportBy={{ bottom: 50, top: 0 }}
                  groupCounts={val.groupCounts}
                  groupContent={(index) => {
                    if (val.groupedItems[index].label === "view_more") {
                      return null;
                    }

                    return val.groupedItems[index].items.length ? (
                      <Box
                        py="4"
                        px="4"
                        background="background"
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text variant={{ weight: "medium" }}>
                          {val.groupedItems[index].label}
                        </Text>

                        <Box marginRight="4">
                          <Text
                            variant={{
                              weight: "normal",
                              type: "muted",
                            }}
                          >
                            {getRewardTypeFormatted(selectedStake.rewardType)}
                          </Text>
                        </Box>
                      </Box>
                    ) : null;
                  }}
                  className={validatorVirtuosoContainer}
                  itemContent={(index, groupIndex) => {
                    if (val.groupedItems[groupIndex]?.label === "view_more") {
                      return (
                        <Box
                          display="flex"
                          justifyContent="center"
                          marginTop="6"
                        >
                          <Button
                            variant={{ color: "secondary", size: "small" }}
                            onClick={onViewMoreClick}
                          >
                            <Text>{t("details.validators_view_all")}</Text>
                          </Button>
                        </Box>
                      );
                    }

                    const item = val.tableData[index];

                    const isPreferred = item.preferred;

                    return (
                      <SelectModalItemContainer>
                        <SelectModalItem onItemClick={() => onItemClick(item)}>
                          <Image
                            containerProps={{ hw: "9" }}
                            imageProps={{ borderRadius: "full" }}
                            src={item.image}
                            fallback={
                              <ImageFallback
                                name={item.name || item.address}
                                tokenLogoHw="9"
                                textVariant={{
                                  type: "white",
                                  weight: "bold",
                                }}
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
                              </Box>

                              <Box>
                                <Text>
                                  {getRewardRateFormatted({
                                    rewardRate: item.apr,
                                    rewardType: selectedStake.rewardType,
                                  })}
                                </Text>
                              </Box>
                            </Box>
                          </Box>
                        </SelectModalItem>
                      </SelectModalItemContainer>
                    );
                  }}
                />
              ))
              .extract()}
          </SelectModal>
        );
      })
      .extractNullable()
  );
};
