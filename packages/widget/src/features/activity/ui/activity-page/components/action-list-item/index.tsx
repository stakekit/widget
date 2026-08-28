import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { ActivityActionItem } from "../../../../model/activity-action";
import { useActionListItem } from "../../hooks/use-action-list-item";
import { ActivityIcon } from "../activity-icon";
import {
  amountNeutral,
  amountPositive,
  completedStatusBadge,
  infoColumn,
  listItem,
  listItemSelected,
  metaRow,
  noWrap,
  statusBadge,
  timeColumn,
  titleText,
  viaText,
} from "../activity-item.css";

export const ActionListItem = ({
  action,
  isSelected = false,
  onActionSelect,
}: {
  action: ActivityActionItem;
  readonly isSelected?: boolean;
  onActionSelect: (action: ActivityActionItem) => void;
}) => {
  const { t } = useTranslation();
  const listItemView = useActionListItem(action);

  if (!listItemView) return null;

  const {
    canOpenDetails,
    providersDetails,
    iconType,
    title,
    tokenSymbol,
    amount,
    amountSign,
    isPositive,
    timestampAbsolute,
    timestampRelative,
    badgeLabel,
    statusLabel,
  } = listItemView;

  const firstProvider = providersDetails?.[0];
  const providerLabel = firstProvider
    ? t("positions.via", {
        providerName: firstProvider.name ?? firstProvider.address,
        count: Math.max((providersDetails?.length ?? 0) - 1, 1),
      })
    : null;
  const viaLabel = providerLabel;

  return (
    <Box py="1" width="full">
      <ListItem
        onClick={canOpenDetails ? () => onActionSelect(action) : undefined}
        className={clsx(listItem, isSelected && listItemSelected)}
        data-rk={
          isSelected ? "activity-list-item-selected" : "activity-list-item"
        }
        variant={{
          hover: canOpenDetails ? "enabled" : "disabled",
        }}
      >
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
            flex={1}
            minWidth="0"
          >
            <ActivityIcon type={iconType} />

            <Box className={infoColumn}>
              <Text className={titleText}>{title}</Text>

              {badgeLabel || viaLabel ? (
                <Box className={metaRow}>
                  {badgeLabel && statusLabel ? (
                    <Box
                      className={
                        statusLabel === "completed"
                          ? completedStatusBadge
                          : statusBadge
                      }
                    >
                      <Text
                        variant={{
                          type: statusLabel === "completed" ? "muted" : "white",
                          size: "small",
                        }}
                        className={noWrap}
                      >
                        {badgeLabel}
                      </Text>
                    </Box>
                  ) : null}

                  {viaLabel ? (
                    <Text
                      className={viaText}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {viaLabel}
                    </Text>
                  ) : null}
                </Box>
              ) : null}
            </Box>
          </Box>

          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            gap="3"
            flexShrink={0}
          >
            {amount ? (
              <Text className={isPositive ? amountPositive : amountNeutral}>
                {amountSign}
                {tokenSymbol ? `${amount} ${tokenSymbol}` : amount}
              </Text>
            ) : null}

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
    </Box>
  );
};
