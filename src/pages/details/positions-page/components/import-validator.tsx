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
  hideScrollbar,
  selectItemText,
  validatorAddress,
  validatorVirtuosoContainer,
} from "./styles.css";
import { Image } from "../../../../components/atoms/image";
import { ImageFallback } from "../../../../components/atoms/image-fallback";
import { PreferredIcon } from "../../../../components/atoms/icons/preferred";
import { useRef } from "react";
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

  return (
    <SelectModal
      ref={modalRef}
      title={t("positions.import_validator_modal_title")}
      onSearch={onValidatorAddressOrNameChange}
      errorMessage={errorMessage}
      isLoading={isLoading}
      onClose={onClose}
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
          <VirtualList
            className={clsx([hideScrollbar, validatorVirtuosoContainer])}
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
                            className={clsx([selectItemText, validatorAddress])}
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
                          variant={{ size: "small" }}
                          onClick={() => {
                            onImportValidatorImport(item);
                            modalRef.current?.close();
                          }}
                        >
                          {t("positions.import_button")}
                        </Button>
                      )}
                    </Box>
                  </SelectModalItem>
                </SelectModalItemContainer>
              );
            }}
          />
        ))
        .extractNullable()}
    </SelectModal>
  );
};
