import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { PositionDetailsLabelType } from "../../../../../../domain/types/positions";
import { TokenIcon } from "../../../../../../shared/ui/components/token-icon";
import { ToolTip } from "../../../../../../shared/ui/components/tooltip";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { SKLink } from "../../../../../../shared/ui/primitives/link";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Spinner } from "../../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { PositionItem } from "../../../../resources/positions";
import { usePositionListItem } from "../hooks/use-position-list-item";
import { listItemContainer, viaText } from "../style.css";
import {
  listItem,
  noWrap,
  positionInfoColumn,
  positionName,
} from "./styles.css";

export const PositionsListItem = memo(({ item }: { item: PositionItem }) => {
  const { t } = useTranslation();

  const {
    integrationData,
    providersDetails,
    inactiveValidator,
    totalAmountFormatted,
    totalAmountPriceFormatted,
  } = usePositionListItem(item);
  const actionBadgeType =
    item.actionRequired || inactiveValidator ? "actionRequired" : "claim";
  const getActionBadgeLabel = () => {
    if (item.actionRequired) return t("positions.action_required");
    if (inactiveValidator === "jailed") {
      return t("details.validators_jailed");
    }
    if (inactiveValidator) return t("details.validators_inactive");
    return t("positions.claim_rewards");
  };
  const actionBadgeLabel = getActionBadgeLabel();

  return (
    <SKLink
      relative="path"
      to={`../positions/${item.integrationId}/${item.balanceId}`}
    >
      <Box py="1">
        {integrationData ? (
          <ListItem className={listItem}>
            <Box
              display="flex"
              width="full"
              alignItems="center"
              justifyContent="space-between"
              gap="2"
            >
              <Box
                display="flex"
                alignItems="center"
                gap="2"
                flex={1}
                minWidth="0"
              >
                {item.token ? (
                  <TokenIcon
                    metadata={{
                      logoURI: integrationData.metadata.logoURI,
                      name: integrationData.metadata.name,
                      provider: integrationData.provider,
                    }}
                    token={item.token}
                  />
                ) : (
                  <Box display="flex" marginRight="2">
                    <Spinner />
                  </Box>
                )}

                <Box className={positionInfoColumn}>
                  <Box display="flex" alignItems="center" gap="1">
                    <Text className={positionName}>
                      {integrationData.metadata.name}
                    </Text>

                    {item.yieldLabelDto ? (
                      <ToolTip
                        textAlign="left"
                        maxWidth={300}
                        label={t(
                          `position_details.labels.${item.yieldLabelDto.type as PositionDetailsLabelType}.details`,
                          item.yieldLabelDto.params as
                            | Record<string, string>
                            | undefined
                        )}
                      >
                        <Box
                          className={listItemContainer({
                            type: "actionRequired",
                          })}
                        >
                          <Text variant={{ type: "white" }} className={noWrap}>
                            {t(
                              `position_details.labels.${item.yieldLabelDto.type as PositionDetailsLabelType}.label`
                            )}
                          </Text>
                        </Box>
                      </ToolTip>
                    ) : null}

                    {(item.actionRequired ||
                      item.hasPendingClaimRewards ||
                      !!inactiveValidator) && (
                      <Box
                        className={listItemContainer({
                          type: actionBadgeType,
                        })}
                      >
                        <Text variant={{ type: "white" }} className={noWrap}>
                          {actionBadgeLabel}
                        </Text>
                      </Box>
                    )}
                  </Box>

                  {providersDetails?.[0] ? (
                    <Text
                      className={viaText}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {t("positions.via", {
                        providerName:
                          providersDetails[0].name ??
                          providersDetails[0].address,
                        count: Math.max(providersDetails.length - 1, 1),
                      })}
                    </Text>
                  ) : null}
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap="4" flexShrink={0}>
                {totalAmountFormatted && item.token ? (
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    textAlign="end"
                    gap="1"
                  >
                    <Text className={noWrap}>
                      {totalAmountFormatted} {item.token.symbol}
                    </Text>

                    {totalAmountPriceFormatted ? (
                      <Text
                        className={noWrap}
                        variant={{ type: "muted", weight: "normal" }}
                      >
                        ≈ ${totalAmountPriceFormatted}
                      </Text>
                    ) : null}
                  </Box>
                ) : null}
              </Box>
            </Box>

            {item.pointsRewardTokenBalances.length > 0 && (
              <Box display="flex" alignSelf="flex-end" gap="1">
                {item.pointsRewardTokenBalances.map((val, i) => (
                  <Box
                    key={i}
                    alignSelf="flex-end"
                    background="background"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="lg"
                    px="2"
                    py="1"
                    gap="1"
                  >
                    <TokenIcon token={val.token} hideNetwork tokenLogoHw="5" />

                    <Text
                      overflowWrap="anywhere"
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {val.amount}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </ListItem>
        ) : (
          <ContentLoaderSquare heightPx={60} />
        )}
      </Box>
    </SKLink>
  );
});
