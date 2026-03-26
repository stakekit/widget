import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import {
  getBaseYieldType,
  getYieldProviderDetails,
  isYieldActionArgRequired,
} from "../../../../../domain/types/yields";
import { useEarnPageContext } from "../../state/earn-page-context";

export const StakedVia = () => {
  const { selectedStake, appLoading } = useEarnPageContext();

  const { t } = useTranslation();
  if (appLoading) return null;
  return selectedStake
    .filter(
      (val) =>
        !!(
          getBaseYieldType(val) === "staking" &&
          !isYieldActionArgRequired(val, "enter", "validatorAddress") &&
          !isYieldActionArgRequired(val, "enter", "validatorAddresses") &&
          getYieldProviderDetails(val)
        )
    )
    .chainNullable((val) => getYieldProviderDetails(val))
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
          wrapperProps={{ hw: "7" }}
          src={val.logoURI}
          fallbackName={val.name}
        />
      </Box>
    ))
    .extractNullable();
};
