import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../../domain/borrow/positions/market-position";
import { widgetRoutes } from "../../../../../../services/navigation/widget-routes";
import { useTokenLogo } from "../../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../../shared/react/widget-presentation";
import { Box, ListRow, TokenAvatar } from "../../../../../../ui/index";
import { useWidgetLinkProps } from "../../../../../navigation/index";
import type { UnifiedPositionItem } from "../../../../state/read-models/positions";
import { EarnPositionListItem } from "../../../components/earn-position-list-item";
import { usePositionListItem } from "../hooks/use-position-list-item";
import { getBorrowMarketPositionListItemModel } from "../model";

const BorrowMarketPositionListItem = ({
  position,
}: {
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const model = getBorrowMarketPositionListItemModel({ locale, position, t });
  const link = useWidgetLinkProps(
    widgetRoutes.borrowPosition.build("Dashboard", { marketId: position.id })
  );
  const logo = useTokenLogo(model.headerToken);

  return (
    <Box paddingBlock={4}>
      <ListRow
        link={link}
        leading={<TokenAvatar {...logo} />}
        title={model.title}
        subtitle={t("positions.via", {
          providerName: model.providerName,
          count: 1,
        })}
        // A borrow rate is a cost, not a positive rate, so it stays neutral;
        // a narrow row keeps its room for the title and the value.
        figure={{ text: model.borrowApy, from: "sm" }}
        value={model.balanceText}
        subvalue={model.subValue}
      />
    </Box>
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
    opensDetailsWithViewTransition
    showsMissingAmountPlaceholder
    showsRewardRate
  />
);

export const PositionsListItem = ({ item }: { item: UnifiedPositionItem }) =>
  item.kind === "borrow" ? (
    <BorrowMarketPositionListItem position={item.position} />
  ) : (
    <EarnPositionsListItem item={item.position} />
  );
