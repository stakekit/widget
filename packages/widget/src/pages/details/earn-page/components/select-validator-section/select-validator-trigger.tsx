import { Trigger } from "@radix-ui/react-dialog";
import type { ValidatorDto } from "@stakekit/api-hooks";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Divider } from "../../../../../components/atoms/divider";
import { CaretDownIcon } from "../../../../../components/atoms/icons/caret-down";
import { PlusIcon } from "../../../../../components/atoms/icons/plus";
import { PreferredIcon } from "../../../../../components/atoms/icons/preferred";
import { XIcon } from "../../../../../components/atoms/icons/x-icon";
import { Image } from "../../../../../components/atoms/image";
import { ImageFallback } from "../../../../../components/atoms/image-fallback";
import { Text } from "../../../../../components/atoms/typography/text";
import { inactiveContainer } from "../../../../../components/molecules/select-validator/styles.css";
import { noWrap } from "../../../../details/positions-page/components/styles.css";
import {
  addValidatorButton,
  addValidatorContainer,
  breakWord,
  validatorPill,
} from "../../styles.css";

export const SelectValidatorTrigger = ({
  onRemoveValidator,
  multiSelect,
  selectedValidatorsArr,
  isWithProviderOptions,
}: {
  onRemoveValidator: (item: ValidatorDto) => void;
  multiSelect: boolean;
  selectedValidatorsArr: ValidatorDto[];
  isWithProviderOptions: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Box
        data-rk="select-validator-trigger-container"
        className={addValidatorContainer}
      >
        <Box display="flex" alignItems="center" justifyContent="center">
          <Text className={breakWord} variant={{ weight: "bold" }}>
            {isWithProviderOptions
              ? t("details.restake_with")
              : t("details.earn_with")}
          </Text>
        </Box>

        {(() => {
          const element = (
            <>
              {selectedValidatorsArr.map((sv) => {
                const nameOrAddress = sv.name ?? sv.address;

                return (
                  <Box key={sv.address}>
                    <Box
                      data-rk="select-validator-trigger"
                      className={validatorPill}
                    >
                      <Box marginRight="2">
                        <Image
                          containerProps={{ hw: "5" }}
                          imageProps={{ borderRadius: "full" }}
                          src={sv.image}
                          fallback={
                            <Box marginRight="1">
                              <ImageFallback
                                name={nameOrAddress}
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
                        {nameOrAddress}
                      </Text>

                      {sv.preferred && (
                        <Box marginLeft="1" display="flex">
                          <PreferredIcon />
                        </Box>
                      )}

                      {sv.status !== "active" && (
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
                              sv.status === "jailed"
                                ? "details.validators_jailed"
                                : "details.validators_inactive"
                            )}
                          </Text>
                        </Box>
                      )}

                      {multiSelect && selectedValidatorsArr.length > 1 && (
                        <Box
                          as="button"
                          display="flex"
                          marginLeft="1"
                          onClick={() => onRemoveValidator(sv)}
                        >
                          <XIcon hw={12} strokeWidth={4.9} />
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}

              {multiSelect ? (
                <Box>
                  <Trigger asChild>
                    <Box
                      data-rk="select-validator-plus"
                      as="button"
                      className={addValidatorButton}
                    >
                      <PlusIcon hw={12} strokeWidth={4.9} />
                    </Box>
                  </Trigger>
                </Box>
              ) : (
                <Box
                  data-rk="select-validator-caret-down"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <CaretDownIcon />
                </Box>
              )}
            </>
          );

          return multiSelect ? (
            element
          ) : (
            <Trigger asChild>
              <Box as="button" display="flex" gap="1">
                {element}
              </Box>
            </Trigger>
          );
        })()}
      </Box>

      <Box marginTop="3">
        <Divider />
      </Box>
    </>
  );
};
