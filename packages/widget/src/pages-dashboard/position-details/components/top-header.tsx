import { Box } from "@sk-widget/components/atoms/box";
import { TokenIcon } from "@sk-widget/components/atoms/token-icon";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { topHeaderYieldName } from "@sk-widget/pages-dashboard/position-details/components/styles.css";
import { usePositionDetails } from "@sk-widget/pages/position-details/hooks/use-position-details";
import { Just, Maybe } from "purify-ts";

export const TopHeader = () => {
  const { unstakeToken, integrationData, positionBalancesByType } =
    usePositionDetails();

  return Maybe.fromRecord({ integrationData, positionBalancesByType })
    .map((val) => (
      <Box>
        {unstakeToken
          .altLazy(() => Just(val.integrationData.token))
          .map((t) => (
            <>
              <Box display="flex" justifyContent="center" alignItems="center">
                <TokenIcon
                  metadata={val.integrationData.metadata}
                  token={t}
                  tokenLogoHw="24"
                  tokenNetworkLogoHw="6"
                />
              </Box>
              <Box
                marginTop="3"
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexDirection="column"
              >
                <Text
                  className={topHeaderYieldName}
                  variant={{ weight: "normal" }}
                  textAlign="center"
                >
                  {val.integrationData.metadata.name}
                </Text>

                <Text variant={{ type: "muted" }}>{t.symbol}</Text>
              </Box>
            </>
          ))
          .extractNullable()}
      </Box>
    ))
    .extractNullable();
};
