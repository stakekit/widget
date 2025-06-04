import { Box } from "@sk-widget/components/atoms/box";
import { Image } from "@sk-widget/components/atoms/image";
import { ImageFallback } from "@sk-widget/components/atoms/image-fallback";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { useTranslation } from "react-i18next";
import { useEarnPageContext } from "../../state/earn-page-context";

export const StakedVia = () => {
  const { selectedStake, appLoading } = useEarnPageContext();

  const { t } = useTranslation();
  if (appLoading) return null;
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
        data-rk="stake-token-section-staked-via"
      >
        <Text variant={{ type: "regular", size: "medium" }}>
          {t("details.earn_with")}{" "}
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
