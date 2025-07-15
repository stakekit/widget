import { Just, Maybe } from "purify-ts";
import { Box } from "../../../components/atoms/box";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { topHeaderYieldName } from "./styles.css";

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
