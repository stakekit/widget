import { GroupedVirtuoso, Virtuoso } from "react-virtuoso";
import { useVirtualListHeight } from "./use-virtual-list-height";

export const VirtualList: typeof Virtuoso = (props) => {
  const heightProps = useVirtualListHeight();

  return <Virtuoso {...heightProps} {...props} />;
};

export const GroupedVirtualList: typeof GroupedVirtuoso = (props) => {
  const heightProps = useVirtualListHeight();

  return <GroupedVirtuoso {...heightProps} {...props} />;
};
