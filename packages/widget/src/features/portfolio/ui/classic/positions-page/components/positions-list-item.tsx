import type { PositionItem } from "../../../../state/read-models/positions";
import { EarnPositionListItem } from "../../../components/earn-position-list-item";
import { usePositionListItem } from "../hooks/use-position-list-item";

export const PositionsListItem = ({ item }: { item: PositionItem }) => (
  <EarnPositionListItem
    item={item}
    details={usePositionListItem(item)}
    presentation="classic"
  />
);
