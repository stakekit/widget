import { useTranslation } from "react-i18next";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderLine } from "../../../../../../shared/ui/primitives/content-loader";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { ActivityActionItem } from "../../../../model/activity-action";
import type { ActivityStatusLabel } from "../../../../model/activity-action-list-item";
import { useActionListItem } from "../../hooks/use-action-list-item";
import { ActivityIcon, type ActivityIconType } from "../activity-icon";
import {
  amountNeutral,
  amountPositive,
  completedStatusBadge,
  infoColumn,
  listItem,
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

  const { providersDetails } = listItemView;

  const firstProvider = providersDetails?.[0];
  const providerLabel = firstProvider
    ? t("positions.via", {
        providerName: firstProvider.name ?? firstProvider.address,
        count: Math.max((providersDetails?.length ?? 0) - 1, 1),
      })
    : null;
  return (
    <ActionListItemPresentation
      view={listItemView}
      viaLabel={providerLabel}
      isSelected={isSelected}
      onSelect={() => onActionSelect(action)}
    />
  );
};

export const ActionListItemSkeleton = () => <ActionListItemPresentation />;

type ActionListItemContent = {
  readonly canOpenDetails: boolean;
  readonly iconType: ActivityIconType;
  readonly title: string;
  readonly tokenSymbol: string | null;
  readonly amount: string | null;
  readonly amountSign: "" | "+" | "-";
  readonly isPositive: boolean;
  readonly timestampAbsolute: string;
  readonly timestampRelative: string;
  readonly badgeLabel: string | null;
  readonly statusLabel: ActivityStatusLabel | null;
};

const ActionListItemPresentation = ({
  view,
  viaLabel,
  isSelected = false,
  onSelect,
}: {
  readonly view?: ActionListItemContent;
  readonly viaLabel?: string | null;
  readonly isSelected?: boolean;
  readonly onSelect?: () => void;
}) => {
  const loading = !view;
  const readyDataRk = isSelected
    ? "activity-list-item-selected"
    : "activity-list-item";
  const {
    canOpenDetails,
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
  } = view ?? {};

  return (
    <Box py="1" width="full" aria-hidden={loading || undefined}>
      <ListItem
        onClick={canOpenDetails ? onSelect : undefined}
        className={listItem}
        data-rk={loading ? "activity-list-item-skeleton" : readyDataRk}
        variant={{
          active: isSelected ? "active" : "inactive",
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
              <Text className={titleText}>
                {loading ? <ContentLoaderLine widthPx="14ch" /> : title}
              </Text>

              {loading || badgeLabel || viaLabel ? (
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

                  {loading || viaLabel ? (
                    <Text
                      className={viaText}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {loading ? (
                        <ContentLoaderLine widthPx="10ch" />
                      ) : (
                        viaLabel
                      )}
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
            {loading || amount ? (
              <Text className={isPositive ? amountPositive : amountNeutral}>
                {loading ? (
                  <ContentLoaderLine widthPx="8ch" />
                ) : (
                  <>
                    {amountSign}
                    {tokenSymbol ? `${amount} ${tokenSymbol}` : amount}
                  </>
                )}
              </Text>
            ) : null}

            <Box className={timeColumn}>
              <Text
                variant={{ type: "muted", weight: "normal", size: "small" }}
              >
                {loading ? (
                  <ContentLoaderLine widthPx="9ch" />
                ) : (
                  timestampAbsolute
                )}
              </Text>
              <Text
                variant={{ type: "muted", weight: "normal", size: "small" }}
              >
                {loading ? (
                  <ContentLoaderLine widthPx="6ch" />
                ) : (
                  timestampRelative
                )}
              </Text>
            </Box>
          </Box>
        </Box>
      </ListItem>
    </Box>
  );
};
