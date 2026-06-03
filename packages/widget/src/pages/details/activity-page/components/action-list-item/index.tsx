import { List } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { ListItem } from "../../../../../components/atoms/list/list-item";
import { Text } from "../../../../../components/atoms/typography/text";
import { listItemContainer } from "../../../positions-page/style.css";
import { useActionListItem } from "../../hooks/use-action-list-item";
import type { ActionYieldDto } from "../../types";
import { ActivityIcon } from "../activity-icon";
import {
  amountNeutral,
  amountPositive,
  infoColumn,
  listItem,
  noWrap,
  timeColumn,
  titleText,
  viaText,
} from "../activity-item.css";

export const ActionListItem = ({
  action,
  onActionSelect,
}: {
  action: ActionYieldDto;
  onActionSelect: (action: ActionYieldDto) => void;
}) => {
  const { t } = useTranslation();
  const {
    integrationData,
    providersDetails,
    iconType,
    title,
    tokenSymbol,
    amount,
    amountSign,
    isPositive,
    timestampAbsolute,
    timestampRelative,
    showFailedBadge,
    badgeLabel,
  } = useActionListItem(action);

  return (
    <Box py="1" width="full">
      {integrationData.mapOrDefault(
        () => (
          <ListItem onClick={() => onActionSelect(action)} className={listItem}>
            <Box
              display="flex"
              width="full"
              justifyContent="space-between"
              alignItems="center"
              gap="2"
            >
              <Box
                display="flex"
                justifyContent="flex-start"
                alignItems="center"
                gap="2"
                minWidth="0"
              >
                <ActivityIcon type={iconType} />

                <Box className={infoColumn}>
                  <Box display="flex" alignItems="center" gap="2">
                    <Text className={titleText}>{title}</Text>

                    {showFailedBadge && (
                      <Box
                        className={listItemContainer({
                          type: "actionRequired",
                        })}
                      >
                        <Text
                          variant={{ type: "white", size: "small" }}
                          className={noWrap}
                        >
                          {badgeLabel}
                        </Text>
                      </Box>
                    )}
                  </Box>

                  {providersDetails
                    .chain((val) =>
                      List.head(val).map((p) => (
                        <Text
                          className={viaText}
                          variant={{ type: "muted", weight: "normal" }}
                        >
                          {t("positions.via", {
                            providerName: p.name ?? p.address,
                            count: Math.max(val.length - 1, 1),
                          })}
                        </Text>
                      ))
                    )
                    .extractNullable()}
                </Box>
              </Box>

              <Box
                display="flex"
                alignItems="center"
                justifyContent="flex-end"
                gap="3"
                flexShrink={0}
              >
                {amount
                  .map((val) => (
                    <Text
                      className={isPositive ? amountPositive : amountNeutral}
                    >
                      {amountSign}
                      {val} {tokenSymbol}
                    </Text>
                  ))
                  .extractNullable()}

                <Box className={timeColumn}>
                  <Text
                    variant={{ type: "muted", weight: "normal", size: "small" }}
                  >
                    {timestampAbsolute}
                  </Text>
                  <Text
                    variant={{ type: "muted", weight: "normal", size: "small" }}
                  >
                    {timestampRelative}
                  </Text>
                </Box>
              </Box>
            </Box>
          </ListItem>
        ),
        <ContentLoaderSquare heightPx={60} />
      )}
    </Box>
  );
};
