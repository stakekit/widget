import { usePositionListItem } from "../../../../react/use-position-list-item";
import type { PositionItem } from "../../../../state/read-models/positions";
import { EarnPositionListItem } from "../../../components/earn-position-list-item";

export const PositionsListItem = ({ item }: { item: PositionItem }) => (
  <EarnPositionListItem
    item={item}
    details={usePositionListItem(item)}
    opensDetailsWithViewTransition={false}
    showsMissingAmountPlaceholder={false}
    showsRewardRate={false}
  />
);
