import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../components/atoms/collapsible";
import { Spinner } from "../../../components/atoms/spinner";
import { Text } from "../../../components/atoms/typography/text";
import { getYieldMetadata } from "../../../domain/types/yields";
import { PositionBalances } from "../../../pages/position-details/components/position-balances";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { ProviderDetails } from "./provider-details";
import { container } from "./styles.css";

export const PositionDetailsInfo = () => {
  const {
    isLoading,
    integrationData,
    positionBalancesByType,
    providersDetails,
    liquidTokensToNativeConversion,
  } = usePositionDetails();

  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner />
      </Box>
    );
  }

  return Maybe.fromRecord({ integrationData, positionBalancesByType })
    .map((val) => (
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        background="stakeSectionBackground"
        borderRadius="xl"
        px="4"
        py="4"
      >
        <Box display="flex" flexDirection="column" gap="2">
          {providersDetails
            .map((pd) =>
              pd.map((p, idx) => (
                <ProviderDetails
                  {...p}
                  key={p.address ?? idx}
                  stakeType={t(
                    `position_details.stake_type.${getYieldMetadata(val.integrationData).type}`
                  )}
                  integrationData={val.integrationData}
                />
              ))
            )
            .extractNullable()}
        </Box>

        <Box py="2" display="flex" flexDirection="column">
          <CollapsibleRoot initial={false}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box
                display="flex"
                justifyContent="flex-start"
                alignItems="center"
              >
                <Text>{t("dashboard.position_details_info.balances")}</Text>
              </Box>

              <CollapsibleTrigger flex={1} justifyContent="flex-end">
                <CollapsibleArrow />
              </CollapsibleTrigger>
            </Box>

            <CollapsibleContent>
              <Box display="flex" flexDirection="column" gap="2" marginTop="4">
                {[...val.positionBalancesByType.values()].flatMap(
                  (yieldBalance) =>
                    yieldBalance.map((yb, i) => (
                      <PositionBalances
                        key={`${yb.type}-${i}`}
                        integrationData={val.integrationData}
                        yieldBalance={yb}
                      />
                    ))
                )}
              </Box>

              {liquidTokensToNativeConversion
                .filter((val) => val.size > 0)
                .map((val) => (
                  <Box
                    my="2"
                    display="flex"
                    alignItems="flex-end"
                    flexDirection="column"
                    gap="1"
                  >
                    {[...val.values()].map((v) => (
                      <Text
                        variant={{ type: "muted", weight: "normal" }}
                        key={v}
                      >
                        {v}
                      </Text>
                    ))}
                  </Box>
                ))
                .extractNullable()}
            </CollapsibleContent>
          </CollapsibleRoot>
        </Box>
      </Box>
    ))
    .extractNullable();
};
