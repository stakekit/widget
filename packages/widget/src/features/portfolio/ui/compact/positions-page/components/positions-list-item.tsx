import type { PositionItem } from "../../../../model/positions";
import { EarnPositionListItem } from "../../../components/earn-position-list-item";
import { usePositionListItem } from "../../../use-position-list-item";

export const PositionsListItem = ({ item }: { item: PositionItem }) => (
  <EarnPositionListItem
    item={item}
    details={usePositionListItem(item)}
    opensDetailsWithViewTransition={false}
    showsMissingAmountPlaceholder={false}
    showsRewardRate={false}
  />
);
