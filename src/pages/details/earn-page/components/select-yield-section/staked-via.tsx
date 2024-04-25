import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import { useDetailsContext } from "../../state/details-context";
import { Image } from "../../../../../components/atoms/image";
import { ImageFallback } from "../../../../../components/atoms/image-fallback";

export const StakedVia = () => {
  const { selectedStake } = useDetailsContext();

  const { t } = useTranslation();

  return selectedStake
    .filter(
      (val) =>
        !!(
          val.metadata.type === "staking" &&
          !val.validators.length &&
          val.metadata.provider
        )
    )
    .chainNullable((val) => val.metadata.provider)
    .map((val) => (
      <Box
        display="flex"
        justifyContent="flex-start"
        alignItems="center"
        marginTop="2"
        gap="2"
      >
        <Text variant={{ type: "regular", size: "medium" }}>
          {t("details.staked_via")}{" "}
          <Box as="span" fontWeight="bold">
            {val.name}
          </Box>
        </Text>

        <Image
          containerProps={{ hw: "7" }}
          src={val.logoURI}
          fallback={<ImageFallback name={val.name} tokenLogoHw="7" />}
        />
      </Box>
    ))
    .extractNullable();
};