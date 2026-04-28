import { Trigger } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Image } from "../../../components/atoms/image";
import { Text } from "../../../components/atoms/typography/text";
import type { ValidatorDto } from "../../../domain/types/validators";
import { breakWord } from "../../../pages/details/earn-page/styles.css";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { changeButton, nameOrAddressText } from "./styles.css";

export const SelectValidatorTrigger = ({
  selectedValidatorsArr,
}: {
  selectedValidatorsArr: ValidatorDto[];
}) => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  return (
    <Box
      data-rk="select-validator-trigger-container"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="2"
    >
      <Text flexShrink={0} className={breakWord}>
        {t("details.earn_with")}
      </Text>

      <Box flex={1} minWidth="0">
        {selectedValidatorsArr.map((v) => {
          const nameOrAddress = v.name ?? v.address;

          return (
            <Box key={v.address} display="flex" alignItems="center" gap="1">
              <Image
                wrapperProps={{ hw: "5", marginLeft: "1" }}
                imgProps={{ borderRadius: "full" }}
                src={v.logoURI}
                fallbackName={nameOrAddress}
              />

              <Text flex={1} minWidth="0" className={nameOrAddressText}>
                {nameOrAddress}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Trigger asChild>
        <Text
          flexShrink={0}
          className={combineRecipeWithVariant({ rec: changeButton, variant })}
        >
          {t("shared.change")}
        </Text>
      </Trigger>
    </Box>
  );
};
