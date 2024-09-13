import { Box, Text } from "@sk-widget/components";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { ListItem } from "@sk-widget/components/atoms/list/list-item";
import { TokenIcon } from "@sk-widget/components/atoms/token-icon";
import { useActionListItem } from "@sk-widget/pages/details/activity-page/hooks/use-action-list-item";
import {
  activityDetailsContainer,
  listItem,
  noWrap,
  viaText,
} from "@sk-widget/pages/details/activity-page/style.css";
import { listItemContainer } from "@sk-widget/pages/details/positions-page/style.css";
import { capitalizeFirstLetter } from "@sk-widget/utils/formatters";
import type { ActionDto, ActionStatus, YieldDto } from "@stakekit/api-hooks";
import { List } from "purify-ts";
import { useTranslation } from "react-i18next";

type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: YieldDto;
};

type ListItemContainerType = "claim" | "pending" | "actionRequired" | undefined;

const bg_pos_map: { [key in ActionStatus]: ListItemContainerType } = {
  SUCCESS: "claim",
  FAILED: "actionRequired",
  CREATED: "pending",
  WAITING_FOR_NEXT: "actionRequired",
  CANCELED: "actionRequired",
  PROCESSING: "claim",
};

const ActionListItem = ({
  action,
  onActionSelect,
}: {
  action: ActionYieldDto;
  onActionSelect: (action: ActionYieldDto) => void;
}) => {
  const { t } = useTranslation();
  const { integrationData, providersDetails } = useActionListItem(action);

  return (
    <Box py="1" width="full">
      {integrationData.mapOrDefault(
        (d) => (
          <ListItem onClick={() => onActionSelect(action)} className={listItem}>
            <Box
              display="flex"
              width="full"
              justifyContent="space-between"
              gap="2"
            >
              <Box
                display="flex"
                justifyContent="flex-start"
                alignItems="center"
              >
                <TokenIcon metadata={d.metadata} token={d.token} />
                <Box
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  alignItems="flex-start"
                  gap="1"
                >
                  <Box className={activityDetailsContainer}>
                    <Text>{d.token.symbol}</Text>

                    <Box
                      className={listItemContainer({
                        type: bg_pos_map[action.actionData.status],
                      })}
                    >
                      <Text
                        variant={{ type: "white", size: "small" }}
                        className={noWrap}
                      >
                        {action.actionData.status}
                      </Text>
                    </Box>
                  </Box>
                  {providersDetails
                    .chain((val) =>
                      List.head(val).map((p) => (
                        <Text
                          className={viaText}
                          variant={{
                            type: "muted",
                            weight: "normal",
                          }}
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
                justifyContent="center"
                alignItems="flex-end"
                flexDirection="column"
                textAlign="end"
                gap="1"
              >
                <Text variant={{ weight: "normal" }}>
                  {capitalizeFirstLetter(action.actionData.type)}
                </Text>

                <Text
                  overflowWrap="anywhere"
                  variant={{ weight: "normal", type: "muted" }}
                >
                  {action.actionData.amount} {d.token.symbol}
                </Text>
              </Box>
            </Box>
          </ListItem>
        ),
        <ContentLoaderSquare heightPx={60} />
      )}
    </Box>
  );
};

export default ActionListItem;
