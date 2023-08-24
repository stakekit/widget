import { Maybe } from "purify-ts";
import {
  Box,
  Button,
  CaretDownIcon,
  Divider,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  Text,
} from "../../../components";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { Image } from "../../../components/atoms/image";
import { useTranslation } from "react-i18next";
import { apyToPercentage } from "../../../utils";
import { breakWord, modalItemNameContainer, tokenLogo } from "../style.css";
import { GroupedVirtuoso } from "react-virtuoso";
import { ValidatorDto } from "@stakekit/api-hooks";
import {
  hideScrollbar,
  triggerStyles,
  validatorVirtuosoContainer,
} from "./styles.css";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { State } from "../../../state/stake/types";
import classNames from "classnames";
import { useMemo, useState } from "react";
import { PreferredIcon } from "../../../components/atoms/icons/preferred";

export const SelectValidator = ({
  selectedStake,
  selectedValidator,
  onValidatorSelect,
}: {
  selectedStake: State["selectedStake"];
  selectedValidator: Maybe<ValidatorDto>;
  onValidatorSelect: (item: ValidatorDto) => void;
}) => {
  const { t } = useTranslation();

  const [viewMore, setViewMore] = useState(false);

  const data = useMemo(
    () =>
      selectedStake.map((ss) => {
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

        return {
          tableData: groupedItems.flatMap((val) => val.items),
          groupedItems,
          groupCounts: groupedItems.map((val) => val.items.length),
        };
      }),
    [selectedStake, t, viewMore]
  );

  return selectedStake
    .chain((ss) => selectedValidator.map((sv) => ({ ss, sv })))
    .map(({ sv, ss }) => {
      return (
        <SelectModal
          title={t("details.validator_search_title")}
          onClose={() => setViewMore(false)}
          trigger={
            <Trigger disabled={!ss.validators.length} className={triggerStyles}>
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
                      src={sv.image}
                      className={tokenLogo}
                      fallback={
                        <Box marginRight="1">
                          <ImageFallback
                            name={sv.name}
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
                        validator: sv.name,
                      })}
                    </Text>

                    {sv.preferred && (
                      <Box marginLeft="1" display="flex">
                        <PreferredIcon />
                      </Box>
                    )}
                    {!!ss.validators.length && (
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
                              name={item.name}
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
                                {item.name}
                              </Text>

                              {isPreferred && (
                                <Box marginLeft="1" display="flex">
                                  <PreferredIcon />
                                </Box>
                              )}
                            </Box>

                            {item.apr && (
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
                    !viewMore ? (
                      <Box display="flex" justifyContent="center" marginTop="6">
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
    .extractNullable();
};
