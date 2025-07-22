import { Trigger } from "@radix-ui/react-dialog";
import type { ValidatorDto } from "@stakekit/api-hooks";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Image } from "../../../components/atoms/image";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { Text } from "../../../components/atoms/typography/text";
import { breakWord } from "../../../pages/details/earn-page/styles.css";
import { changeButton, nameOrAddressText } from "./styles.css";

export const SelectValidatorTrigger = ({
  selectedValidatorsArr,
}: {
  selectedValidatorsArr: ValidatorDto[];
}) => {
  const { t } = useTranslation();

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
                containerProps={{ hw: "5", marginLeft: "1" }}
                imageProps={{ borderRadius: "full" }}
                src={v.image}
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

              <Text flex={1} minWidth="0" className={nameOrAddressText}>
                {nameOrAddress}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Trigger asChild>
        <Text flexShrink={0} className={changeButton}>
          {t("shared.change")}
        </Text>
      </Trigger>
    </Box>
  );
};
