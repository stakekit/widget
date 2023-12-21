import { useTranslation } from "react-i18next";
import {
  Box,
  CaretDownIcon,
  Divider,
  Text,
  XIcon,
} from "../../../../../components";
import {
  addValidatorButton,
  addValidatorContainer,
  breakWord,
  validatorPill,
} from "../../styles.css";
import { ValidatorDto } from "@stakekit/api-hooks";
import { Image } from "../../../../../components/atoms/image";
import { ImageFallback } from "../../../../../components/atoms/image-fallback";
import { PreferredIcon } from "../../../../../components/atoms/icons/preferred";
import { PlusIcon } from "../../../../../components/atoms/icons/plus";
import { Trigger } from "@radix-ui/react-alert-dialog";

export const SelectValidatorTrigger = ({
  onRemoveValidator,
  supportsMultiVal,
  selectedValidatorsArr,
}: {
  onRemoveValidator: (item: ValidatorDto) => void;
  supportsMultiVal: boolean;
  selectedValidatorsArr: ValidatorDto[];
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Box className={addValidatorContainer}>
        <Box display="flex" alignItems="center" justifyContent="center">
          <Text className={breakWord} variant={{ weight: "bold" }}>
            {t("details.staked_via")}
          </Text>
        </Box>

        {(() => {
          const element = (
            <>
              {selectedValidatorsArr.map((sv) => {
                const nameOrAddress = sv.name ?? sv.address;

                return (
                  <Box key={sv.address}>
                    <Box className={validatorPill}>
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

                      {supportsMultiVal && selectedValidatorsArr.length > 1 && (
                        <Box
                          as="button"
                          display="flex"
                          marginLeft="1"
                          onClick={() => onRemoveValidator(sv)}
                        >
                          <XIcon hw={12} strokeWidth={3.5} />
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}

              {supportsMultiVal ? (
                <Box>
                  <Trigger asChild>
                    <Box as="button" className={addValidatorButton}>
                      <PlusIcon />
                    </Box>
                  </Trigger>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center">
                  <CaretDownIcon />
                </Box>
              )}
            </>
          );

          return supportsMultiVal ? (
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

      <Box marginTop="4">
        <Divider />
      </Box>
    </>
  );
};
