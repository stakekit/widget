import { Box } from "@sk-widget/components/atoms/box";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "@sk-widget/components/atoms/collapsible";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { Spinner } from "@sk-widget/components/atoms/spinner";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { ProviderDetails } from "@sk-widget/pages-dashboard/position-details/components/provider-details";
import { container } from "@sk-widget/pages-dashboard/position-details/components/styles.css";
import { PositionBalances } from "@sk-widget/pages/position-details/components/position-balances";
import { usePositionDetails } from "@sk-widget/pages/position-details/hooks/use-position-details";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";

export const PositionDetailsInfo = () => {
  const {
    isLoading,
    integrationData,
    positionBalancesByType,
    providersDetails,
    positionLabel,
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
        background="backgroundMuted"
        borderRadius="xl"
        px="4"
        py="4"
      >
        {positionLabel
          .map((l) => (
            <Box
              background="stakeSectionBackground"
              borderRadius="xl"
              marginTop="2"
              py="4"
              px="4"
            >
              <Box
                display="flex"
                alignItems="center"
                justifyContent="flex-start"
                gap="1"
              >
                <Box display="flex" alignItems="center" justifyContent="center">
                  <InfoIcon />
                </Box>

                <Text variant={{ type: "muted", size: "small" }}>
                  {
                    t(
                      `position_details.labels.${l.type}.details`,
                      l.params
                    ) as string
                  }
                </Text>
              </Box>
            </Box>
          ))
          .extractNullable()}

        <Box display="flex" flexDirection="column" gap="2">
          {providersDetails
            .map((pd) =>
              pd.map((p, idx) => (
                <ProviderDetails
                  {...p}
                  key={p.address ?? idx}
                  stakeType={t(
                    `position_details.stake_type.${val.integrationData.metadata.type}`
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
