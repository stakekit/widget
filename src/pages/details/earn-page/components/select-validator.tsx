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
import { GroupedVirtuoso } from "react-virtuoso";
import { ValidatorDto } from "@stakekit/api-hooks";
import { ImageFallback } from "../../../../components/atoms/image-fallback";
import classNames from "clsx";
import { useMemo, useState } from "react";
import { PreferredIcon } from "../../../../components/atoms/icons/preferred";
import {
  breakWord,
  hideScrollbar,
  modalItemNameContainer,
  tokenLogo,
  triggerStyles,
  validatorVirtuosoContainer,
} from "../styles.css";
import { useDetailsContext } from "../hooks/details-context";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";

export const SelectValidator = () => {
  const { t } = useTranslation();

  const { isLoading, onValidatorSelect, selectedValidator, selectedStake } =
    useDetailsContext();

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

        return {
          tableData: groupedItems.flatMap((val) => val.items),
          groupedItems: groupedItems.filter((val) => val.items.length),
          groupCounts: groupedItems
            .filter((val) => val.items.length)
            .map((val) => val.items.length),
          canViewMore: groupedItems[0].items.length !== ss.validators.length,
        };
      }),
    [selectedStake, t, viewMore]
  );

  return isLoading ? (
    <Box marginTop="2" display="flex">
      <ContentLoaderSquare heightPx={20} />
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
                                size: "small",
                                type: "white",
                                weight: "bold",
                              }}
                            />
                          </Box>
                        }
                      />
                      <Text
                        className={breakWord}
                        variant={{ weight: "bold", size: "small" }}
                      >
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
                <GroupedVirtuoso
                  groupCounts={val.groupCounts}
                  groupContent={(index) => {
                    return val.groupedItems[index].items.length ? (
                      <Box
                        py="4"
                        px="4"
                        background="background"
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text variant={{ weight: "medium", size: "small" }}>
                          {val.groupedItems[index].label}
                        </Text>

                        <Box marginRight="4">
                          <Text
                            variant={{
                              weight: "normal",
                              type: "muted",
                              size: "small",
                            }}
                          >
                            APR
                          </Text>
                        </Box>
                      </Box>
                    ) : null;
                  }}
                  className={classNames([
                    validatorVirtuosoContainer,
                    hideScrollbar,
                  ])}
                  itemContent={(index) => {
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
                                  size: "small",
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
                                <Text
                                  variant={{
                                    size: "small",
                                    weight: "bold",
                                  }}
                                >
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
                                  <Text variant={{ size: "small" }}>
                                    {apyToPercentage(item.apr)}%
                                  </Text>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </SelectModalItem>
                      </SelectModalItemContainer>
                    );
                  }}
                  components={{
                    Footer: () =>
                      !viewMore && val.canViewMore ? (
                        <Box
                          display="flex"
                          justifyContent="center"
                          marginTop="6"
                        >
                          <Button
                            variant={{
                              color: "secondary",
                              size: "small",
                              border: "thick",
                            }}
                            onClick={() => setViewMore(true)}
                          >
                            <Text>{t("details.validators_view_all")}</Text>
                          </Button>
                        </Box>
                      ) : null,
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