import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../../domain/borrow/positions/market-position";
import { TokenIcon } from "../../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { SKLink } from "../../../../../../shared/ui/primitives/link";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { UnifiedPositionItem } from "../../../../state/read-models/positions";
import { EarnPositionListItem } from "../../../components/earn-position-list-item";
import {
  listItem,
  noWrap,
  positionBadge,
  positionInfoColumn,
  positionName,
  rewardRateText,
  viaText,
} from "../../../components/position-list-item.css";
import { usePositionListItem } from "../hooks/use-position-list-item";
import { getBorrowMarketPositionListItemModel } from "../model";

const BorrowMarketPositionListItem = ({
  position,
}: {
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();
  const model = getBorrowMarketPositionListItemModel({ position, t });

  return (
    <SKLink relative="path" to={`../positions/borrow/${position.id}`}>
      <Box py="1">
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
              <TokenIcon token={model.headerToken} />

              <Box className={positionInfoColumn}>
                <Box display="flex" alignItems="center" gap="1">
                  <Text className={positionName}>{model.title}</Text>
                  <Box className={positionBadge({ type: "pending" })}>
                    <Text variant={{ type: "white" }} className={noWrap}>
                      {t("dashboard.details.tabs.borrow")}
                    </Text>
                  </Box>
                </Box>

                <Text
                  className={viaText}
                  variant={{ type: "muted", weight: "normal" }}
                >
                  {t("positions.via", {
                    providerName: model.providerName,
                    count: 1,
                  })}
                </Text>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap="4" flexShrink={0}>
              <Text className={rewardRateText}>{model.borrowApy}</Text>

              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-end"
                textAlign="end"
                gap="1"
              >
                <Text className={noWrap}>{model.balanceText}</Text>
                <Text
                  className={noWrap}
                  variant={{ type: "muted", weight: "normal" }}
                >
                  {model.subValue}
                </Text>
              </Box>
            </Box>
          </Box>
        </ListItem>
      </Box>
    </SKLink>
  );
};

const EarnPositionsListItem = ({
  item,
}: {
  item: Extract<UnifiedPositionItem, { kind: "earn" }>["position"];
}) => (
  <EarnPositionListItem
    item={item}
    details={usePositionListItem(item)}
    presentation="dashboard"
  />
);

export const PositionsListItem = ({ item }: { item: UnifiedPositionItem }) =>
  item.kind === "borrow" ? (
    <BorrowMarketPositionListItem position={item.position} />
  ) : (
    <EarnPositionsListItem item={item.position} />
  );
