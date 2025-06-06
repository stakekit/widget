import { Trigger } from "@radix-ui/react-dialog";
import { Box } from "@sk-widget/components/atoms/box";
import { Image } from "@sk-widget/components/atoms/image";
import { ImageFallback } from "@sk-widget/components/atoms/image-fallback";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { changeButton } from "@sk-widget/pages-dashboard/overview/earn-page/styles.css";
import { breakWord } from "@sk-widget/pages/details/earn-page/styles.css";
import type { ValidatorDto } from "@stakekit/api-hooks";
import { useTranslation } from "react-i18next";

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
      <Text className={breakWord}>{t("details.earn_with")}</Text>

      <Box>
        {selectedValidatorsArr.map((v) => {
          const nameOrAddress = v.name ?? v.address;

          return (
            <Box key={v.address} display="flex" alignItems="center" gap="1">
              <Image
                containerProps={{ hw: "5" }}
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
              <Text>{nameOrAddress}</Text>
            </Box>
          );
        })}
      </Box>

      <Trigger asChild>
        <Text className={changeButton}>{t("shared.change")}</Text>
      </Trigger>
    </Box>
  );
};
