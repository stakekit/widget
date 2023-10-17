import { Maybe } from "purify-ts";
import {
  Box,
  Button,
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
  SelectModalProps,
  Text,
} from "../../../../components";
import { useTranslation } from "react-i18next";
import { Trigger } from "@radix-ui/react-alert-dialog";
import { ValidatorDto, ValidatorSearchResultDto } from "@stakekit/api-hooks";
import clsx from "clsx";
import {
  importValidatorContainer,
  selectItemText,
  validatorAddress,
} from "./styles.css";
import { Image } from "../../../../components/atoms/image";
import { ImageFallback } from "../../../../components/atoms/image-fallback";
import { PreferredIcon } from "../../../../components/atoms/icons/preferred";
import { useRef, useState } from "react";
import { VirtualList } from "../../../../components/atoms/virtual-list";

export const ImportValidator = ({
  foundValidatorsData,
  onValidatorAddressOrNameChange,
  errorMessage,
  isLoading,
  onClose,
  onImportValidatorImport,
}: {
  foundValidatorsData: Maybe<
    {
      integrationId: ValidatorSearchResultDto["integrationId"];
      validator: ValidatorDto;
    }[]
  >;
  onValidatorAddressOrNameChange: (validatorAddress: string) => void;
  onImportValidatorImport: (val: {
    integrationId: ValidatorSearchResultDto["integrationId"];
    validator: ValidatorDto;
  }) => void;
} & Pick<SelectModalProps, "isLoading" | "errorMessage" | "onClose">) => {
  const { t } = useTranslation();

  const modalRef = useRef<{ close: () => void }>(null);
  const [searchValue, setSearchValue] = useState("");

  return (
    <SelectModal
      title={t("positions.import_validator_modal_title")}
      searchValue={searchValue}
      onSearch={(val) => {
        setSearchValue(val);
        onValidatorAddressOrNameChange(val);
      }}
      errorMessage={errorMessage}
      isLoading={isLoading}
      onClose={() => {
        setSearchValue("");
        onClose?.();
      }}
      trigger={
        <Trigger asChild>
          <Box>
            <Button variant={{ size: "small", color: "smallButton" }}>
              <Text>{t("positions.import_button")}</Text>
            </Button>
          </Box>
        </Trigger>
      }
    >
      {foundValidatorsData
        .map((val) => (
          <Box className={importValidatorContainer}>
            {!searchValue && (
              <Box marginTop="2">
                <SelectModalItemContainer>
                  <Text>{t("positions.search_for_validators")}</Text>
                </SelectModalItemContainer>
              </Box>
            )}
            <VirtualList
              data={val}
              itemContent={(_index, item) => {
                return (
                  <SelectModalItemContainer>
                    <SelectModalItem>
                      <Box display="flex" gap="2" minWidth="0" marginRight="4">
                        <Box>
                          <Image
                            hw="9"
                            borderRadius="full"
                            src={item.validator.image}
                            fallback={
                              <ImageFallback
                                name={item.validator.name}
                                tokenLogoHw="9"
                              />
                            }
                          />
                        </Box>

                        <Box display="flex" flexDirection="column" minWidth="0">
                          <Box display="flex" alignItems="center">
                            <Text
                              className={clsx([
                                selectItemText,
                                validatorAddress,
                              ])}
                              variant={{ weight: "bold" }}
                            >
                              {item.validator.name}
                            </Text>

                            {item.validator.preferred && (
                              <Box marginLeft="1" display="flex">
                                <PreferredIcon />
                              </Box>
                            )}
                          </Box>

                          {item.validator.name !== item.validator.address && (
                            <Text
                              variant={{ weight: "normal" }}
                              className={validatorAddress}
                            >
                              {item.validator.address}
                            </Text>
                          )}
                        </Box>
                      </Box>

                      <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="flex-end"
                        textAlign="right"
                      >
                        {item.validator.preferred ? (
                          <Text>
                            {t("positions.import_validator_already_imported")}
                          </Text>
                        ) : (
                          <Button
                            variant={{ size: "small", color: "smallButton" }}
                            onClick={() => {
                              onImportValidatorImport(item);
                              modalRef.current?.close();
                            }}
                          >
                            <Text>{t("positions.import_button")}</Text>
                          </Button>
                        )}
                      </Box>
                    </SelectModalItem>
                  </SelectModalItemContainer>
                );
              }}
            />
          </Box>
        ))
        .extractNullable()}
    </SelectModal>
  );
};
