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
import { apyToPercentage } from "../../../../utils";
import { ValidatorDto } from "@stakekit/api-hooks";
import { ImageFallback } from "../../../../components/atoms/image-fallback";
import { useMemo, useState } from "react";
import { PreferredIcon } from "../../../../components/atoms/icons/preferred";
import {
  breakWord,
  modalItemNameContainer,
  tokenLogo,
  triggerStyles,
  validatorVirtuosoContainer,
} from "../styles.css";
import { useDetailsContext } from "../hooks/details-context";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";
import { GroupedVirtualList } from "../../../../components/atoms/virtual-list";

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
  } = useDetailsContext();

  const isLoading =
    appLoading ||
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

        const sortedValidators = ss.validators
          .filter((val) => !!val.apr)
          .slice()
          .sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));

        const groupedItems = sortedValidators.reduce(
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
        if (!groupedItems[0].items.length && sortedValidators.length) {
          return {
            canViewMore: false,
            tableData: sortedValidators,
            groupCounts: [sortedValidators.length],
            groupedItems: [
              { items: sortedValidators, label: t("details.validators_other") },
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

  return isLoading ? (
    <Box marginTop="2" display="flex">
      <ContentLoaderSquare
        heightPx={20}
        rXY="7"
        uniqueKey="earn-page/select-validator/loader"
      />
    </Box>
  ) : (
    Maybe.fromRecord({ selectedStake, selectedValidator })
      .map((val) => {
        return (
          <SelectModal
            title={t("details.validator_search_title")}
            onClose={() => setViewMore(false)}
            trigger={
              <Trigger
                disabled={!val.selectedStake.validators.length}
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
                      <Image
                        hw="5"
                        marginRight="2"
                        src={val.selectedValidator.image}
                        className={tokenLogo}
                        fallback={
                          <Box marginRight="1">
                            <ImageFallback
                              name={
                                val.selectedValidator.name ||
                                val.selectedValidator.address
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
                      <Text className={breakWord} variant={{ weight: "bold" }}>
                        {t("details.staked_via", {
                          validator:
                            val.selectedValidator.name ??
                            val.selectedValidator.address,
                        })}
                      </Text>

                      {val.selectedValidator.preferred && (
                        <Box marginLeft="1" display="flex">
                          <PreferredIcon />
                        </Box>
                      )}
                      {!!val.selectedStake.validators.length && (
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
                            APR
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
                            onClick={() => setViewMore(true)}
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
                        <SelectModalItem
                          onItemClick={() => onValidatorSelect(item)}
                        >
                          <Image
                            hw="9"
                            src={item.image}
                            className={tokenLogo}
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

                              {"apr" in item && (
                                <Box>
                                  <Text>{apyToPercentage(item.apr)}%</Text>
                                </Box>
                              )}
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
