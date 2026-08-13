import { useTranslation } from "react-i18next";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../../../services/transaction-workflow/transaction-workflow-model";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { ActivityActionItem } from "../../../../model/activity-action";
import { useActionListItem } from "../../hooks/use-action-list-item";
import { ActivityIcon } from "../activity-icon";
import {
  amountNeutral,
  amountPositive,
  failedBadge,
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
  action: ActivityActionItem;
  onActionSelect: (
    action: ActivityActionItem,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) => void;
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
    showFailedBadge,
    badgeLabel,
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
        onClick={
          canOpenDetails
            ? () => onActionSelect(action, providersDetails ?? [])
            : undefined
        }
        className={listItem}
        variant={{ hover: canOpenDetails ? "enabled" : "disabled" }}
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
            minWidth="0"
          >
            <ActivityIcon type={iconType} />

            <Box className={infoColumn}>
              <Box display="flex" alignItems="center" gap="2">
                <Text className={titleText}>{title}</Text>

                {showFailedBadge && (
                  <Box className={failedBadge}>
                    <Text
                      variant={{ type: "white", size: "small" }}
                      className={noWrap}
                    >
                      {badgeLabel}
                    </Text>
                  </Box>
                )}
              </Box>

              {viaLabel ? (
                <Text
                  className={viaText}
                  variant={{ type: "muted", weight: "normal" }}
                >
                  {viaLabel}
                </Text>
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
                {amount} {tokenSymbol}
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
