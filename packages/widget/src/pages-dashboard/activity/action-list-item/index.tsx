import type { ActionDto, YieldDto } from "@stakekit/api-hooks";
import clsx from "clsx";
import { List } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { ListItem } from "../../../components/atoms/list/list-item";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import { useActionListItem } from "../../../pages/details/activity-page/hooks/use-action-list-item";
import {
  badgeText,
  listItemContainer,
  utilaBadgeText,
} from "../../../pages/details/positions-page/style.css";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import {
  activityDetailsContainer,
  listItem,
  noWrap,
  viaText,
} from "./style.css";

type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: YieldDto;
};

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
    actionType,
    amount,
    badgeLabel,
    badgeColor,
  } = useActionListItem(action);

  const { variant } = useSettings();

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
                justifyContent="center"
                alignItems="center"
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

                      {variant !== "utila" && (
                        <Badge
                          badgeColor={badgeColor}
                          badgeLabel={badgeLabel}
                        />
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

                {variant === "utila" && (
                  <Badge badgeColor={badgeColor} badgeLabel={badgeLabel} />
                )}
              </Box>

              <Box
                display="flex"
                justifyContent="center"
                alignItems="flex-end"
                flexDirection="column"
                textAlign="end"
                gap="1"
              >
                <Text variant={{ weight: "normal" }}>{actionType}</Text>

                <Text
                  overflowWrap="anywhere"
                  variant={{ weight: "normal", type: "muted" }}
                >
                  {amount.extractNullable()} {d.token.symbol}
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

const Badge = ({
  badgeColor,
  badgeLabel,
}: {
  badgeColor: ReturnType<typeof useActionListItem>["badgeColor"];
  badgeLabel: ReturnType<typeof useActionListItem>["badgeLabel"];
}) => {
  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: listItemContainer,
        variant,
        type: badgeColor,
      })}
    >
      {variant === "utila" ? (
        <Text
          className={utilaBadgeText({
            type:
              badgeColor === "claim"
                ? "success"
                : badgeColor === "actionRequired"
                  ? "error"
                  : "regular",
          })}
        >
          {badgeLabel}
        </Text>
      ) : (
        <Text
          variant={{
            type: badgeColor ? "white" : "regular",
            size: "small",
          }}
          className={clsx(
            noWrap,
            badgeText({
              type: badgeColor ? "white" : "regular",
            })
          )}
        >
          {badgeLabel}
        </Text>
      )}
    </Box>
  );
};
